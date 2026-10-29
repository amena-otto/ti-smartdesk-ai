import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('PUBLIC_FORM_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

type PublicReport = {
  solicitanteTipo: 'estudiante' | 'docente' | 'administrativo';
  solicitanteNombre?: string;
  dni?: string;
  correo?: string;
  docenteId?: string;
  areaId?: string;
  fallaId?: string;
  ambienteId?: string;
  ubicacion?: string;
  descripcion?: string;
  claveIdempotencia?: string;
};

function response(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isReport(value: unknown): value is PublicReport {
  if (typeof value !== 'object' || value === null) return false;
  const report = value as Record<string, unknown>;
  return ['estudiante', 'docente', 'administrativo'].includes(String(report.solicitanteTipo)) &&
    typeof report.descripcion === 'string' && report.descripcion.trim().length >= 5 &&
    typeof report.claveIdempotencia === 'string' && isUuid(report.claveIdempotencia) &&
    typeof report.fallaId === 'string' && isUuid(report.fallaId);
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ message: 'Método no permitido.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return response({ message: 'Servicio no disponible.' }, 503);

  let payload: unknown;
  try { payload = await request.json(); } catch { return response({ message: 'Solicitud inválida.' }, 400); }
  if (!isReport(payload)) return response({ message: 'Completa los datos requeridos.' }, 400);

  const report = payload;
  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ipHash = await sha256(ip);
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data, error } = await supabase.rpc('registrar_ticket_publico', {
    p_solicitante_tipo: report.solicitanteTipo,
    p_solicitante_nombre: report.solicitanteNombre?.trim() ?? '',
    p_dni: report.dni?.trim() ?? null,
    p_correo: report.correo?.trim().toLowerCase() ?? null,
    p_docente_id: report.docenteId ?? null,
    p_area_id: report.areaId ?? null,
    p_falla_id: report.fallaId,
    p_ambiente_id: report.ambienteId ?? null,
    p_ubicacion: report.ubicacion?.trim() ?? null,
    p_descripcion: report.descripcion.trim(),
    p_clave_idempotencia: report.claveIdempotencia,
    p_ip_hash: ipHash,
  });

  if (error || !Array.isArray(data) || typeof data[0]?.numero_ticket !== 'string') {
    const token = error?.message ?? '';
    const status = token.includes('demasiadas_solicitudes') ? 429 : token.includes('invalido') || token.includes('invalidos') || token.includes('rechazada') ? 400 : 500;
    return response({ message: status === 429 ? 'Se alcanzó el límite temporal. Intenta más tarde.' : status === 400 ? 'Revisa los datos ingresados.' : 'No se pudo registrar la incidencia.' }, status);
  }

  return response({ codigoSeguimiento: data[0].numero_ticket, mensaje: 'Tu incidencia fue registrada correctamente.' });
});
