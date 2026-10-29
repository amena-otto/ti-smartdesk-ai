import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useAuth } from '../features/auth/use-auth';
import { obtenerReporteEficiencia, type EfficiencyReport } from '../features/reports/report-service';

export function ReportsPage() {
  const { profile } = useAuth();
  const [report, setReport] = useState<EfficiencyReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); const result = await obtenerReporteEficiencia(); if (result.ok) setReport(result.data); else setError(result.message); setLoading(false); }, []);
  useEffect(() => { if (profile?.rol === 'admin') { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); } return undefined; }, [profile, load]);
  if (profile?.rol !== 'admin') return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Este reporte está reservado a administradores activos.</div>;
  if (loading) return <p role="status">Cargando reporte…</p>;
  if (error || !report) return <div className="space-y-3"><p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error ?? 'Reporte no disponible.'}</p><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><RefreshCw className="size-4" />Reintentar</button></div>;
  const { resumen } = report;
  const cards = [['Recibidos', resumen.recibidos], ['Resueltos', resumen.resueltos], ['Pendientes', resumen.pendientes], ['Reabiertos', resumen.reabiertos], ['Tasa de resolución', `${resumen.tasa_resolucion ?? 0}%`], ['Inicio promedio', `${resumen.tiempo_inicio_minutos ?? '—'} min`], ['Resolución promedio', `${resumen.tiempo_resolucion_minutos ?? '—'} min`]] as const;
  return <div className="space-y-6"><Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft className="size-4" />Volver al panel</Link><div><p className="text-sm font-medium text-blue-600">Solo ADMIN</p><h1 className="mt-1 text-3xl font-semibold text-slate-900">Eficiencia del Área TI</h1><p className="mt-2 text-sm text-slate-600">Métricas históricas en zona horaria America/Lima, calculadas con tickets e historial.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p></div>)}</div><section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="p-5"><h2 className="font-semibold text-slate-900">Evolución diaria, semanal y mensual</h2></div><div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50"><tr><th className="px-5 py-3 text-left">Periodo</th><th className="px-5 py-3 text-left">Fecha</th><th className="px-5 py-3 text-right">Recibidos</th><th className="px-5 py-3 text-right">Resueltos</th></tr></thead><tbody className="divide-y divide-slate-100">{report.evolucion.map((point) => <tr key={`${point.periodo}-${point.fecha}`}><td className="px-5 py-3">{point.periodo}</td><td className="px-5 py-3">{point.fecha}</td><td className="px-5 py-3 text-right">{point.recibidos}</td><td className="px-5 py-3 text-right">{point.resueltos}</td></tr>)}</tbody></table></div></section></div>;
}
