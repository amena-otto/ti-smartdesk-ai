import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CirclePlay,
  Lock,
  RotateCcw,
  Save,
  UserCheck,
} from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  formatTicketDate,
  getCanalOrigenLabel,
  getSolicitanteTipoLabel,
  getTicketPermisos,
  validateMotivoReapertura,
  validateSolucion,
  type Ticket,
  type TicketHistorialItem,
} from '../domain/ticket';
import { useAuth } from '../features/auth/use-auth';
import { TicketHistory } from '../features/tickets/TicketHistory';
import { TicketStatusBadge } from '../features/tickets/TicketStatusBadge';
import {
  cerrarTicket,
  iniciarAtencion,
  obtenerHistorial,
  obtenerTicket,
  reabrirTicket,
  resolverTicket,
  tomarTicket,
  type TicketResult,
} from '../features/tickets/ticket-service';

export function TicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [historial, setHistorial] = useState<TicketHistorialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [solutionOpen, setSolutionOpen] = useState(false);
  const [solution, setSolution] = useState('');
  const [solutionError, setSolutionError] = useState<string | null>(null);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenError, setReopenError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [createdNotice] = useState(
    () =>
      typeof location.state === 'object' &&
      location.state !== null &&
      'created' in location.state &&
      (location.state as { created?: unknown }).created === true,
  );

  useEffect(() => {
    if (!createdNotice) {
      return;
    }

    navigate(location.pathname, { replace: true, state: null });
  }, [createdNotice, location.pathname, navigate]);

  useEffect(() => {
    if (!ticketId) {
      return;
    }

    let active = true;

    void Promise.all([obtenerTicket(ticketId), obtenerHistorial(ticketId)]).then(
      ([ticketResult, historyResult]) => {
        if (!active) {
          return;
        }

        setLoading(false);

        if (!ticketResult.ok) {
          setError(ticketResult.message);
        } else if (!ticketResult.data) {
          setError('El ticket no existe o no tienes permiso para consultarlo.');
        } else {
          setTicket(ticketResult.data);
        }

        if (historyResult.ok) {
          setHistorial(historyResult.data);
          setHistoryError(null);
        } else {
          setHistoryError(historyResult.message);
        }
      },
    );

    return () => {
      active = false;
    };
  }, [ticketId, refreshToken]);

  const refreshHistory = useCallback(async () => {
    if (!ticketId) {
      return;
    }

    const result = await obtenerHistorial(ticketId);

    if (result.ok) {
      setHistorial(result.data);
      setHistoryError(null);
    } else {
      setHistoryError(result.message);
    }
  }, [ticketId]);

  async function runAction(
    action: () => Promise<TicketResult<Ticket>>,
    successMessage: string,
  ): Promise<boolean> {
    if (actionLoading) {
      return false;
    }

    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    const result = await action();

    if (!result.ok) {
      setActionError(result.message);

      if (ticketId) {
        const refreshed = await obtenerTicket(ticketId);

        if (refreshed.ok && refreshed.data) {
          setTicket(refreshed.data);
        }
      }

      setActionLoading(false);
      await refreshHistory();
      return false;
    }

    setTicket(result.data);
    setActionSuccess(successMessage);
    setActionLoading(false);
    await refreshHistory();
    return true;
  }

  async function handleTake() {
    if (!ticket) {
      return;
    }

    await runAction(
      () => tomarTicket(ticket.id),
      'Ticket tomado. Ahora puedes iniciar la atención.',
    );
  }

  async function handleStart() {
    if (!ticket) {
      return;
    }

    await runAction(
      () => iniciarAtencion(ticket.id),
      'Atención iniciada. El ticket está en atención.',
    );
  }

  async function handleResolve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!ticket) {
      return;
    }

    const validation = validateSolucion(solution);
    setSolutionError(validation);

    if (validation) {
      return;
    }

    const success = await runAction(
      () => resolverTicket(ticket.id, solution),
      'Ticket resuelto. La solución quedó registrada en el historial.',
    );

    if (success) {
      setSolution('');
      setSolutionOpen(false);
    }
  }

  async function handleClose() {
    if (!ticket) {
      return;
    }

    const success = await runAction(
      () => cerrarTicket(ticket.id),
      'Ticket cerrado. Puedes reabrirlo si el problema reaparece.',
    );

    if (success) {
      setConfirmClose(false);
    }
  }

  async function handleReopen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!ticket) {
      return;
    }

    const validation = validateMotivoReapertura(reopenReason);
    setReopenError(validation);

    if (validation) {
      return;
    }

    const success = await runAction(
      () => reabrirTicket(ticket.id, reopenReason),
      'Ticket reabierto y devuelto a la cola.',
    );

    if (success) {
      setReopenReason('');
      setReopenOpen(false);
    }
  }

  if (!ticketId) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Link
          to="/tickets"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a la bandeja
        </Link>
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700"
        >
          No se indicó un ticket válido.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        role="status"
        className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600"
      >
        Cargando el ticket…
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Link
          to="/tickets"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a la bandeja
        </Link>
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">No se pudo abrir el ticket</p>
              <p className="mt-1">{error ?? 'El ticket no está disponible.'}</p>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  setRefreshToken((token) => token + 1);
                }}
                className="mt-4 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const permisos = profile
    ? getTicketPermisos(ticket, profile)
    : {
        tomar: false,
        iniciar: false,
        resolver: false,
        cerrar: false,
        reabrir: false,
      };
  const hasActions =
    permisos.tomar ||
    permisos.iniciar ||
    permisos.resolver ||
    permisos.cerrar ||
    permisos.reabrir;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/tickets"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a la bandeja
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {ticket.asunto}
          </h1>
          <TicketStatusBadge estado={ticket.estado} />
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Ticket <strong>{ticket.numeroTicket}</strong> · Creado el{' '}
          {formatTicketDate(ticket.fechaCreacion)}
        </p>
      </div>

      {createdNotice ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>
            El ticket se registró correctamente en estado Nuevo. Ya aparece en
            la bandeja para que un técnico lo tome.
          </p>
        </div>
      ) : null}

      {actionSuccess ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>{actionSuccess}</p>
        </div>
      ) : null}

      {actionError ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>{actionError}</p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Detalle de la incidencia
            </h2>
            <dl className="mt-4 grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Categoría
                </dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {ticket.categoriaNombre ?? 'Sin categoría'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Canal de origen
                </dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {getCanalOrigenLabel(ticket.canalOrigen)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Solicitante
                </dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {ticket.solicitanteNombre}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Tipo de solicitante
                </dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {getSolicitanteTipoLabel(ticket.solicitanteTipo)}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-slate-500">
                  Ubicación
                </dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {ticket.ubicacion ?? 'No indicada'}
                </dd>
              </div>
            </dl>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="text-xs font-medium text-slate-500">
                Descripción
              </h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-800">
                {ticket.descripcion}
              </p>
            </div>
          </section>

          {ticket.solucion ? (
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {ticket.fechaResolucion
                  ? 'Solución registrada'
                  : 'Solución anterior'}
              </h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-800">
                {ticket.solucion}
              </p>
              {ticket.fechaResolucion ? (
                <p className="mt-3 text-xs text-slate-500">
                  Resuelto el {formatTicketDate(ticket.fechaResolucion)}
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Fechas del ciclo
            </h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-slate-500">Creado</dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {formatTicketDate(ticket.fechaCreacion)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Inicio de atención
                </dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {formatTicketDate(ticket.fechaInicioAtencion)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Resolución
                </dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {formatTicketDate(ticket.fechaResolucion)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Cierre</dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {formatTicketDate(ticket.fechaCierre)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Historial cronológico
            </h2>
            <div className="mt-4">
              {historyError ? (
                <p role="alert" className="text-sm text-red-700">
                  {historyError}
                </p>
              ) : (
                <TicketHistory items={historial} />
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Asignación</h2>
            <dl className="mt-4 space-y-4">
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Técnico asignado
                </dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">
                  {ticket.tecnicoAsignadoNombre ?? 'Sin asignar'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Estado actual
                </dt>
                <dd className="mt-1">
                  <TicketStatusBadge estado={ticket.estado} />
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Acciones</h2>

            {profile?.rol === 'admin' ? (
              <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-slate-600">
                <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Tu perfil administrativo tiene lectura de tickets, pero las
                transiciones las realizan los técnicos.
              </p>
            ) : null}

            <div className="mt-4 space-y-3">
              {permisos.tomar ? (
                <button
                  type="button"
                  onClick={() => void handleTake()}
                  disabled={actionLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <UserCheck className="size-4" aria-hidden="true" />
                  {actionLoading ? 'Procesando…' : 'Tomar ticket'}
                </button>
              ) : null}

              {permisos.iniciar ? (
                <button
                  type="button"
                  onClick={() => void handleStart()}
                  disabled={actionLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CirclePlay className="size-4" aria-hidden="true" />
                  {actionLoading ? 'Procesando…' : 'Iniciar atención'}
                </button>
              ) : null}

              {permisos.resolver && !solutionOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setSolutionOpen(true);
                    setSolutionError(null);
                  }}
                  disabled={actionLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Resolver ticket
                </button>
              ) : null}

              {permisos.resolver && solutionOpen ? (
                <form onSubmit={(event) => void handleResolve(event)} noValidate>
                  <label
                    htmlFor="solucion"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Solución <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    id="solucion"
                    value={solution}
                    onChange={(event) => {
                      setSolution(event.target.value);
                      setSolutionError(null);
                    }}
                    rows={4}
                    maxLength={4000}
                    aria-invalid={Boolean(solutionError)}
                    aria-describedby={
                      solutionError ? 'solucion-error' : undefined
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    placeholder="Describe la solución aplicada."
                  />
                  {solutionError ? (
                    <p
                      id="solucion-error"
                      role="alert"
                      className="mt-1 text-xs text-red-700"
                    >
                      {solutionError}
                    </p>
                  ) : null}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Save className="size-4" aria-hidden="true" />
                      {actionLoading ? 'Guardando…' : 'Guardar solución'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSolutionOpen(false);
                        setSolutionError(null);
                      }}
                      disabled={actionLoading}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : null}

              {permisos.cerrar && !confirmClose ? (
                <button
                  type="button"
                  onClick={() => setConfirmClose(true)}
                  disabled={actionLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Lock className="size-4" aria-hidden="true" />
                  Cerrar ticket
                </button>
              ) : null}

              {permisos.cerrar && confirmClose ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm text-slate-700">
                    ¿Confirmas el cierre del ticket? Podrás reabrirlo si el
                    problema reaparece.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleClose()}
                      disabled={actionLoading}
                      className="inline-flex flex-1 items-center justify-center rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {actionLoading ? 'Cerrando…' : 'Confirmar cierre'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClose(false)}
                      disabled={actionLoading}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : null}

              {permisos.reabrir && !reopenOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setReopenOpen(true);
                    setReopenError(null);
                  }}
                  disabled={actionLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-purple-300 bg-white px-4 py-2.5 text-sm font-semibold text-purple-700 transition hover:bg-purple-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Reabrir ticket
                </button>
              ) : null}

              {permisos.reabrir && reopenOpen ? (
                <form onSubmit={(event) => void handleReopen(event)} noValidate>
                  <label
                    htmlFor="motivo-reapertura"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Motivo de reapertura{' '}
                    <span className="text-slate-400">(opcional)</span>
                  </label>
                  <textarea
                    id="motivo-reapertura"
                    value={reopenReason}
                    onChange={(event) => {
                      setReopenReason(event.target.value);
                      setReopenError(null);
                    }}
                    rows={3}
                    maxLength={1000}
                    aria-invalid={Boolean(reopenError)}
                    aria-describedby={
                      reopenError ? 'motivo-reapertura-error' : undefined
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                    placeholder="Explica por qué se reabre el ticket."
                  />
                  {reopenError ? (
                    <p
                      id="motivo-reapertura-error"
                      role="alert"
                      className="mt-1 text-xs text-red-700"
                    >
                      {reopenError}
                    </p>
                  ) : null}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-purple-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RotateCcw className="size-4" aria-hidden="true" />
                      {actionLoading ? 'Reabriendo…' : 'Confirmar reapertura'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReopenOpen(false);
                        setReopenError(null);
                      }}
                      disabled={actionLoading}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : null}

              {!hasActions && profile?.rol === 'tecnico' ? (
                <p className="text-sm leading-6 text-slate-600">
                  No hay acciones disponibles para tu usuario en este estado.
                  {ticket.tecnicoAsignadoId &&
                  ticket.tecnicoAsignadoId !== profile.id
                    ? ' El ticket está asignado a otro técnico.'
                    : ''}
                </p>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
