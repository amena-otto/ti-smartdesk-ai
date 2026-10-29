import { requireSupabase } from '../../lib/supabase';

export type CatalogItem = { id: string; nombre: string };
export type Docente = CatalogItem & { correo_institucional: string };
type DocenteRow = { id: string; nombre_completo: string; correo_institucional: string };
export type Piso = CatalogItem & { pabellon_id: string };
export type Ambiente = CatalogItem & { piso_id: string };
export type Falla = CatalogItem;

export type PublicReportInput = {
  solicitanteTipo: 'estudiante' | 'docente' | 'administrativo';
  solicitanteNombre: string;
  dni: string;
  correo: string;
  docenteId: string;
  areaId: string;
  fallaId: string;
  ambienteId: string;
  ubicacion: string;
  descripcion: string;
  claveIdempotencia: string;
};

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

async function list<T>(table: string, columns: string, order = 'nombre'): Promise<Result<T[]>> {
  const { data, error } = await requireSupabase().from(table).select(columns).order(order);
  if (error || !Array.isArray(data)) return { ok: false, message: 'No se pudo cargar el catálogo.' };
  return { ok: true, data: data as T[] };
}

export function listarDocentes(): Promise<Result<Docente[]>> {
  return list<DocenteRow>('catalogo_docentes', 'id, nombre_completo, correo_institucional').then((result) =>
    result.ok ? { ok: true, data: result.data.map((item) => ({ id: item.id, nombre: item.nombre_completo, correo_institucional: item.correo_institucional })) } : result,
  );
}

export function listarPabellones(): Promise<Result<CatalogItem[]>> { return list('catalogo_pabellones', 'id, nombre'); }
export async function listarPisos(pabellonId: string): Promise<Result<Piso[]>> {
  if (!pabellonId) return { ok: true, data: [] };
  const { data, error } = await requireSupabase()
    .from('catalogo_pisos')
    .select('id, nombre, pabellon_id')
    .eq('pabellon_id', pabellonId)
    .eq('activo', true)
    .order('nombre');
  if (error || !Array.isArray(data)) return { ok: false, message: 'No se pudo cargar el catálogo.' };
  return { ok: true, data: data as Piso[] };
}
export function listarAmbientes(): Promise<Result<Ambiente[]>> { return list('catalogo_ambientes', 'id, nombre, piso_id'); }
export function listarAreas(): Promise<Result<CatalogItem[]>> { return list('catalogo_areas_administrativas', 'id, nombre'); }

export async function listarFallas(tipo: PublicReportInput['solicitanteTipo']): Promise<Result<Falla[]>> {
  const { data, error } = await requireSupabase().from('catalogo_fallas_solicitante').select('falla:catalogo_fallas_comunes!catalogo_fallas_solicitante_falla_id_fkey(id, nombre)').eq('solicitante_tipo', tipo);
  if (error || !Array.isArray(data)) return { ok: false, message: 'No se pudo cargar el catálogo de fallas.' };
  const fallas = data.flatMap((row) => {
    const falla = (row as { falla?: Falla | Falla[] }).falla;
    const item = Array.isArray(falla) ? falla[0] : falla;
    return item?.id && item.nombre ? [item] : [];
  });
  return { ok: true, data: fallas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')) };
}

export async function registrarIncidenciaPublica(input: PublicReportInput): Promise<Result<{ codigoSeguimiento: string; mensaje: string }>> {
  const { data, error } = await requireSupabase().functions.invoke('registrar-incidencia-publica', { body: input });
  if (error || typeof data !== 'object' || data === null) return { ok: false, message: 'No se pudo registrar la incidencia. Intenta nuevamente.' };
  const result = data as { codigoSeguimiento?: unknown; mensaje?: unknown; message?: unknown };
  if (typeof result.codigoSeguimiento === 'string' && typeof result.mensaje === 'string') return { ok: true, data: { codigoSeguimiento: result.codigoSeguimiento, mensaje: result.mensaje } };
  return { ok: false, message: typeof result.message === 'string' ? result.message : 'Revisa los datos ingresados.' };
}
