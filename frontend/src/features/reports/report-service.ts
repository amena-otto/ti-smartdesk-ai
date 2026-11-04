import type { SolicitanteTipo } from '../../domain/ticket';
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

export type ReportPoint = {
  periodo: string;
  fecha: string;
  recibidos: number;
  resueltos: number;
};

export type EfficiencyReport = {
  resumen: ReportSummary;
  evolucion: ReportPoint[];
};

export type ReportFilters = {
  fechaDesde: string;
  fechaHasta: string;
  categoriaId: string;
  solicitanteTipo: SolicitanteTipo | '';
};

export const EMPTY_REPORT_FILTERS: ReportFilters = {
  fechaDesde: '',
  fechaHasta: '',
  categoriaId: '',
  solicitanteTipo: '',
};

export type ReportState = {
  report: EfficiencyReport | null;
  error: string | null;
  loading: boolean;
};

export type ReportAction =
  | { type: 'start' }
  | { type: 'success'; data: EfficiencyReport }
  | { type: 'failure'; message: string };

export const initialReportState: ReportState = {
  report: null,
  error: null,
  loading: true,
};

/**
 * Estado explícito de la carga del reporte. Al iniciar una nueva carga se
 * limpia el error anterior y al recibir una respuesta correcta también, para
 * que el reintento no quede atrapado en la pantalla de error.
 */
export function reportReducer(
  state: ReportState,
  action: ReportAction,
): ReportState {
  switch (action.type) {
    case 'start':
      return { ...state, loading: true, error: null };
    case 'success':
      return { report: action.data, error: null, loading: false };
    case 'failure':
      return { ...state, error: action.message, loading: false };
  }
}

export function calcularTasaResolucion(
  recibidos: number,
  resueltos: number,
): number {
  return recibidos > 0
    ? Math.round((resueltos * 10000) / recibidos) / 100
    : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function countOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function parseSummary(value: unknown): ReportSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    recibidos: countOrZero(value.recibidos),
    resueltos: countOrZero(value.resueltos),
    pendientes: countOrZero(value.pendientes),
    reabiertos: countOrZero(value.reabiertos),
    tiempo_inicio_minutos: numberOrNull(value.tiempo_inicio_minutos),
    tiempo_resolucion_minutos: numberOrNull(value.tiempo_resolucion_minutos),
    tasa_resolucion: numberOrNull(value.tasa_resolucion),
  };
}

export function parseReporteEficiencia(
  data: unknown,
): EfficiencyReport | null {
  if (!isRecord(data) || !Array.isArray(data.evolucion)) {
    return null;
  }

  const resumen = parseSummary(data.resumen);

  if (!resumen) {
    return null;
  }

  const evolucion = data.evolucion.filter(isRecord).flatMap((point) =>
    typeof point.periodo === 'string' &&
    typeof point.fecha === 'string' &&
    typeof point.recibidos === 'number' &&
    Number.isFinite(point.recibidos) &&
    typeof point.resueltos === 'number' &&
    Number.isFinite(point.resueltos)
      ? [
          {
            periodo: point.periodo,
            fecha: point.fecha,
            recibidos: point.recibidos,
            resueltos: point.resueltos,
          },
        ]
      : [],
  );

  return { resumen, evolucion };
}

export async function obtenerReporteEficiencia(
  filters: ReportFilters = EMPTY_REPORT_FILTERS,
): Promise<{ ok: true; data: EfficiencyReport } | { ok: false; message: string }> {
  const { data, error } = await requireSupabase().rpc(
    'obtener_reporte_eficiencia',
    {
      p_fecha_desde: filters.fechaDesde || null,
      p_fecha_hasta: filters.fechaHasta || null,
      p_categoria_id: filters.categoriaId || null,
      p_solicitante_tipo: filters.solicitanteTipo || null,
    },
  );

  if (error) {
    return { ok: false, message: 'No se pudo cargar el reporte de eficiencia.' };
  }

  const report = parseReporteEficiencia(data);

  return report
    ? { ok: true, data: report }
    : { ok: false, message: 'No se pudo cargar el reporte de eficiencia.' };
}
