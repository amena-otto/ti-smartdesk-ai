import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Plus,
  RefreshCw,
  Ticket as TicketIcon,
} from 'lucide-react';
import {
  formatTicketDate,
  getSolicitanteTipoLabel,
  type Categoria,
  type Ticket,
  type TicketEstado,
} from '../domain/ticket';
import { TicketFilters } from '../features/tickets/TicketFilters';
import { TicketStatusBadge } from '../features/tickets/TicketStatusBadge';
import {
  listarCategorias,
  listarTickets,
} from '../features/tickets/ticket-service';
import { useAuth } from '../features/auth/use-auth';

export function TicketsPage() {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [estado, setEstado] = useState<TicketEstado | 'todos'>('todos');
  const [categoriaId, setCategoriaId] = useState('todas');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    void listarCategorias().then((result) => {
      if (!active) {
        return;
      }

      if (!result.ok) {
        setCategoriesError(result.message);
        return;
      }

      setCategoriesError(null);
      setCategorias(result.data);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    void listarTickets({ estado, categoriaId }).then((result) => {
      if (!active) {
        return;
      }

      setLoading(false);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setTickets(result.data);
    });

    return () => {
      active = false;
    };
  }, [estado, categoriaId, reloadToken]);

  const canCreate = profile?.rol === 'tecnico';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-600">Operación</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Bandeja de tickets
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Los tickets se crean antes de atender la incidencia. Tómalos desde
            la cola, inicia la atención y registra la solución al resolverlos.
          </p>
        </div>

        {canCreate ? (
          <Link
            to="/tickets/nuevo"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <Plus className="size-4" aria-hidden="true" />
            Nuevo ticket
          </Link>
        ) : null}
      </div>

      {categoriesError ? (
        <p
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          No se pudieron cargar las categorías. Los filtros por categoría
          pueden estar incompletos. {categoriesError}
        </p>
      ) : null}

      <TicketFilters
        estado={estado}
        categoriaId={categoriaId}
        categorias={categorias}
        onEstadoChange={(nextEstado) => {
          setLoading(true);
          setError(null);
          setEstado(nextEstado);
        }}
        onCategoriaChange={(nextCategoriaId) => {
          setLoading(true);
          setError(null);
          setCategoriaId(nextCategoriaId);
        }}
        onClear={() => {
          setLoading(true);
          setError(null);
          setEstado('todos');
          setCategoriaId('todas');
        }}
      />

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-medium">No se pudo cargar la bandeja</p>
              <p className="mt-1">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  setReloadToken((token) => token + 1);
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Reintentar
              </button>
            </div>
          </div>
        </div>
      ) : loading ? (
        <div
          role="status"
          className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600"
        >
          Cargando tickets…
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <TicketIcon
            className="mx-auto size-10 text-slate-400"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-base font-semibold text-slate-900">
            No hay tickets con estos filtros
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Cambia los filtros o registra un ticket nuevo para comenzar.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Ticket
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Solicitante
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Categoría
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Estado
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Técnico
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Creado
                  </th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Abrir</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-4 align-top">
                      <Link
                        to={`/tickets/${ticket.id}`}
                        className="text-sm font-semibold text-blue-700 hover:text-blue-800 hover:underline"
                      >
                        {ticket.numeroTicket}
                      </Link>
                      <p className="mt-1 max-w-xs text-sm text-slate-700">
                        {ticket.asunto}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <p className="text-sm text-slate-900">
                        {ticket.solicitanteNombre}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {getSolicitanteTipoLabel(ticket.solicitanteTipo)}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-slate-700">
                      {ticket.categoriaNombre ?? 'Sin categoría'}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <TicketStatusBadge estado={ticket.estado} />
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-slate-700">
                      {ticket.tecnicoAsignadoNombre ?? 'Sin asignar'}
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-slate-600">
                      {formatTicketDate(ticket.fechaCreacion)}
                    </td>
                    <td className="px-4 py-4 align-top text-right">
                      <Link
                        to={`/tickets/${ticket.id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800"
                      >
                        Abrir
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
