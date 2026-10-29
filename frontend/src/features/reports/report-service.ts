import { requireSupabase } from '../../lib/supabase';

export type ReportSummary = {
  recibidos: number;
  resueltos: number;
  pendientes: number;
  reabiertos: number;
  tiempo_inicio_minutos: number | null;
  tiempo_resolucion_minutos: number | null;
  tasa_resolucion: number | null;
};

export type ReportPoint = { periodo: string; fecha: string; recibidos: number; resueltos: number };
export type EfficiencyReport = { resumen: ReportSummary; evolucion: ReportPoint[] };

export function calcularTasaResolucion(recibidos: number, resueltos: number): number {
  return recibidos > 0 ? Math.round((resueltos * 10000) / recibidos) / 100 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
function numberOrNull(value: unknown): number | null { return typeof value === 'number' ? value : null; }

export async function obtenerReporteEficiencia(): Promise<{ ok: true; data: EfficiencyReport } | { ok: false; message: string }> {
  const { data, error } = await requireSupabase().rpc('obtener_reporte_eficiencia');
  if (error || !isRecord(data) || !isRecord(data.resumen) || !Array.isArray(data.evolucion)) return { ok: false, message: 'No se pudo cargar el reporte de eficiencia.' };
  const r = data.resumen;
  const evolucion = data.evolucion.filter(isRecord).flatMap((point) => typeof point.periodo === 'string' && typeof point.fecha === 'string' && typeof point.recibidos === 'number' && typeof point.resueltos === 'number' ? [{ periodo: point.periodo, fecha: point.fecha, recibidos: point.recibidos, resueltos: point.resueltos }] : []);
  return { ok: true, data: { resumen: { recibidos: typeof r.recibidos === 'number' ? r.recibidos : 0, resueltos: typeof r.resueltos === 'number' ? r.resueltos : 0, pendientes: typeof r.pendientes === 'number' ? r.pendientes : 0, reabiertos: typeof r.reabiertos === 'number' ? r.reabiertos : 0, tiempo_inicio_minutos: numberOrNull(r.tiempo_inicio_minutos), tiempo_resolucion_minutos: numberOrNull(r.tiempo_resolucion_minutos), tasa_resolucion: numberOrNull(r.tasa_resolucion) }, evolucion } };
}
