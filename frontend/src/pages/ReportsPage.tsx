import { useCallback, useEffect, useReducer, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useAuth } from '../features/auth/use-auth';
import {
  EMPTY_REPORT_FILTERS,
  initialReportState,
  obtenerReporteEficiencia,
  reportReducer,
  type EfficiencyReport,
  type ReportFilters,
} from '../features/reports/report-service';
import { listarCategorias } from '../features/tickets/ticket-service';
import {
  SOLICITANTE_TIPOS,
  getSolicitanteTipoLabel,
  type Categoria,
} from '../domain/ticket';

export function ReportsPage() {
  const { profile } = useAuth();
  const [state, dispatch] = useReducer(reportReducer, initialReportState);
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_REPORT_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<ReportFilters>(EMPTY_REPORT_FILTERS);
  const [categories, setCategories] = useState<Categoria[]>([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const esAdminActivo = profile?.rol === 'admin' && profile.activo;

  const load = useCallback(async () => {
    dispatch({ type: 'start' });
    const result = await obtenerReporteEficiencia(appliedFilters);

    if (result.ok) {
      dispatch({ type: 'success', data: result.data });
    } else {
      dispatch({ type: 'failure', message: result.message });
    }
  }, [appliedFilters]);

  useEffect(() => {
    if (!esAdminActivo) {
      return undefined;
    }

    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [esAdminActivo, load]);

  useEffect(() => {
    if (!esAdminActivo) {
      return undefined;
    }

    let active = true;

    void listarCategorias().then((result) => {
      if (!active) {
        return;
      }

      if (result.ok) {
        setCategories(result.data);
        setCategoriesError(null);
      } else {
        setCategoriesError(result.message);
      }
    });

    return () => {
      active = false;
    };
  }, [esAdminActivo]);

  function updateFilter<K extends keyof ReportFilters>(
    key: K,
    value: ReportFilters[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters(filters);
  }

  function resetFilters() {
    setFilters(EMPTY_REPORT_FILTERS);
    setAppliedFilters(EMPTY_REPORT_FILTERS);
  }

  if (!esAdminActivo) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Este reporte está reservado a administradores activos.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-slate-600"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver al panel
      </Link>

      <div>
        <p className="text-sm font-medium text-blue-600">Solo ADMIN</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">
          Eficiencia del Área TI
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Métricas históricas en zona horaria America/Lima. Los tickets
          resueltos se cuentan por la fecha real de resolución del historial y
          cada promedio usa únicamente el ciclo vigente del ticket.
        </p>
      </div>

      <form
        onSubmit={applyFilters}
        className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-5"
      >
        <div>
          <label
            htmlFor="reporte-desde"
            className="block text-xs font-medium text-slate-600"
          >
            Desde
          </label>
          <input
            id="reporte-desde"
            type="date"
            value={filters.fechaDesde}
            onChange={(event) => updateFilter('fechaDesde', event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="reporte-hasta"
            className="block text-xs font-medium text-slate-600"
          >
            Hasta
          </label>
          <input
            id="reporte-hasta"
            type="date"
            value={filters.fechaHasta}
            onChange={(event) => updateFilter('fechaHasta', event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="reporte-categoria"
            className="block text-xs font-medium text-slate-600"
          >
            Categoría
          </label>
          <select
            id="reporte-categoria"
            value={filters.categoriaId}
            onChange={(event) => updateFilter('categoriaId', event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.nombre}
                {category.activo ? '' : ' (inactiva)'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="reporte-solicitante"
            className="block text-xs font-medium text-slate-600"
          >
            Tipo de solicitante
          </label>
          <select
            id="reporte-solicitante"
            value={filters.solicitanteTipo}
            onChange={(event) =>
              updateFilter(
                'solicitanteTipo',
                event.target.value as ReportFilters['solicitanteTipo'],
              )
            }
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {SOLICITANTE_TIPOS.map((tipo) => (
              <option key={tipo} value={tipo}>
                {getSolicitanteTipoLabel(tipo)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="inline-flex flex-1 items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
          >
            Aplicar
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
          >
            Limpiar
          </button>
        </div>
      </form>

      {categoriesError ? (
        <p role="alert" className="text-sm text-red-700">
          {categoriesError}
        </p>
      ) : null}

      {state.loading ? <p role="status">Cargando reporte…</p> : null}

      {!state.loading && (state.error || !state.report) ? (
        <div className="space-y-3">
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
          >
            {state.error ?? 'Reporte no disponible.'}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Reintentar
          </button>
        </div>
      ) : null}

      {!state.loading && state.report ? (
        <ReportContent report={state.report} />
      ) : null}
    </div>
  );
}

function ReportContent({ report }: { report: EfficiencyReport }) {
  const { resumen } = report;
  const cards = [
    ['Recibidos', String(resumen.recibidos)],
    ['Resueltos', String(resumen.resueltos)],
    ['Pendientes', String(resumen.pendientes)],
    ['Reabiertos', String(resumen.reabiertos)],
    ['Tasa de resolución', `${resumen.tasa_resolucion ?? 0}%`],
    ['Inicio promedio', `${resumen.tiempo_inicio_minutos ?? '—'} min`],
    [
      'Resolución promedio',
      `${resumen.tiempo_resolucion_minutos ?? '—'} min`,
    ],
  ] as const;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {value}
            </p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-5">
          <h2 className="font-semibold text-slate-900">
            Evolución diaria, semanal y mensual
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Recibidos por fecha de creación; resueltos por fecha real del evento
            de resolución.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left">Periodo</th>
                <th className="px-5 py-3 text-left">Fecha</th>
                <th className="px-5 py-3 text-right">Recibidos</th>
                <th className="px-5 py-3 text-right">Resueltos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.evolucion.map((point) => (
                <tr key={`${point.periodo}-${point.fecha}`}>
                  <td className="px-5 py-3">{point.periodo}</td>
                  <td className="px-5 py-3">{point.fecha}</td>
                  <td className="px-5 py-3 text-right">{point.recibidos}</td>
                  <td className="px-5 py-3 text-right">{point.resueltos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
