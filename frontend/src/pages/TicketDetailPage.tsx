import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { formatTicketDate, getCanalOrigenLabel, getSolicitanteTipoLabel, getTicketPermisos, validateMotivoReapertura, validateSolucion, type Ticket, type TicketHistorialItem } from '../domain/ticket';
import { useAuth } from '../features/auth/use-auth';
import { TicketHistory } from '../features/tickets/TicketHistory';
import { TicketStatusBadge } from '../features/tickets/TicketStatusBadge';
import { cerrarTicket, iniciarAtencion, obtenerHistorial, obtenerTicket, reabrirTicket, resolverTicket, type TicketResult } from '../features/tickets/ticket-service';

export function TicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { profile } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [historial, setHistorial] = useState<TicketHistorialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [solution, setSolution] = useState('');
  const [reason, setReason] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    const [ticketResult, historyResult] = await Promise.all([obtenerTicket(ticketId), obtenerHistorial(ticketId)]);
    setLoading(false);
    if (!ticketResult.ok || !ticketResult.data) setError(ticketResult.ok ? 'El ticket no existe o no tienes permiso para consultarlo.' : ticketResult.message);
    else setTicket(ticketResult.data);
    if (historyResult.ok) setHistorial(historyResult.data);
  }, [ticketId]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  async function run(action: () => Promise<TicketResult<Ticket>>, message: string) {
    if (busy) return;
    setBusy(true); setActionError(null); setActionSuccess(null);
    const result = await action();
    if (!result.ok) setActionError(result.message);
    else { setTicket(result.data); setActionSuccess(message); setSolution(''); setReason(''); await load(); }
    setBusy(false);
  }

  if (!ticketId) return <p role="alert">No se indicó un ticket válido.</p>;
  if (loading) return <p role="status" className="rounded-xl border border-slate-200 bg-white p-6">Cargando el ticket…</p>;
  if (error || !ticket) return <div className="space-y-4"><Link to="/tickets" className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft className="size-4" />Volver</Link><p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{error ?? 'Ticket no disponible.'}</p></div>;
  const currentTicket = ticket;
  const permisos = profile ? getTicketPermisos(currentTicket, profile) : { tomar: false, iniciar: false, resolver: false, cerrar: false, reabrir: false };
  const solutionError = solution.length > 0 ? validateSolucion(solution) : null;
  const reasonError = validateMotivoReapertura(reason);

  function submitSolution(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const validation = validateSolucion(solution); if (validation) { setActionError(validation); return; } void run(() => resolverTicket(currentTicket.id, solution), 'Ticket resuelto. La solución quedó registrada.'); }
  function submitReopen(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (reasonError) { setActionError(reasonError); return; } void run(() => reabrirTicket(currentTicket.id, reason), 'Ticket reabierto y disponible para el Área TI.'); }

  return <div className="mx-auto max-w-4xl space-y-5">
    <Link to="/tickets" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600"><ArrowLeft className="size-4" />Volver a la bandeja</Link>
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-slate-500">{ticket.numeroTicket} · Área TI</p><h1 className="mt-1 text-2xl font-semibold text-slate-900">{ticket.asunto}</h1></div><TicketStatusBadge estado={ticket.estado} /></header>
    {actionError ? <p role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="size-4" />{actionError}</p> : null}
    {actionSuccess ? <p role="status" className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="size-4" />{actionSuccess}</p> : null}
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Información esencial</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><dt className="text-xs text-slate-500">Descripción</dt><dd className="mt-1 whitespace-pre-line text-sm text-slate-900">{ticket.descripcion}</dd></div><div><dt className="text-xs text-slate-500">Categoría</dt><dd className="mt-1 text-sm text-slate-900">{ticket.categoriaNombre ?? 'Sin categoría'}</dd></div><div><dt className="text-xs text-slate-500">Solicitante</dt><dd className="mt-1 text-sm text-slate-900">{ticket.solicitanteNombre} · {getSolicitanteTipoLabel(ticket.solicitanteTipo)}</dd></div><div><dt className="text-xs text-slate-500">Canal / ubicación</dt><dd className="mt-1 text-sm text-slate-900">{getCanalOrigenLabel(ticket.canalOrigen)} · {ticket.ubicacion ?? 'Sin ubicación'}</dd></div><div><dt className="text-xs text-slate-500">Creado</dt><dd className="mt-1 text-sm text-slate-900">{formatTicketDate(ticket.fechaCreacion)}</dd></div></dl></section>
    <section className="rounded-xl border border-blue-200 bg-white p-6 shadow-sm"><h2 className="text-sm font-semibold text-slate-900">Acción del Área TI</h2><p className="mt-1 text-sm text-slate-600">Cualquier administrador activo puede continuar la atención. La acción queda auditada con su cuenta.</p><div className="mt-4 space-y-3">
      {permisos.iniciar ? <button disabled={busy} onClick={() => void run(() => iniciarAtencion(ticket.id), 'Atención iniciada.')} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Procesando…' : 'Iniciar atención'}</button> : null}
      {permisos.resolver ? <form onSubmit={submitSolution} className="space-y-2"><label htmlFor="solution" className="text-sm font-medium text-slate-700">Solución obligatoria</label><textarea id="solution" value={solution} onChange={(event) => setSolution(event.target.value)} rows={4} maxLength={4000} className="w-full rounded-lg border border-slate-300 p-3 text-sm" placeholder="Describe la solución aplicada y verificada." />{solutionError ? <p className="text-xs text-red-700">{solutionError}</p> : null}<button disabled={busy} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Resolver ticket</button></form> : null}
      {permisos.cerrar ? <button disabled={busy} onClick={() => void run(() => cerrarTicket(ticket.id), 'Ticket cerrado.')} className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Cerrar ticket</button> : null}
      {permisos.reabrir ? <form onSubmit={submitReopen} className="space-y-2"><label htmlFor="reason" className="text-sm font-medium text-slate-700">Motivo de reapertura (opcional)</label><textarea id="reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={1000} className="w-full rounded-lg border border-slate-300 p-3 text-sm" /><button disabled={busy} className="w-full rounded-lg border border-blue-300 px-4 py-2.5 text-sm font-semibold text-blue-700 disabled:opacity-50">Reabrir ticket</button></form> : null}
    </div></section>
    {ticket.solucion ? <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-sm font-semibold text-slate-900">Solución registrada</h2><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-800">{ticket.solucion}</p></section> : null}
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm"><button type="button" onClick={() => setHistoryOpen((open) => !open)} aria-expanded={historyOpen} className="flex w-full items-center justify-between p-5 text-left text-sm font-semibold text-slate-900">Historial de acciones <span aria-hidden="true">{historyOpen ? '−' : '+'}</span></button>{historyOpen ? <div className="border-t border-slate-200 p-5"><TicketHistory items={historial} /></div> : null}</section>
  </div>;
}
