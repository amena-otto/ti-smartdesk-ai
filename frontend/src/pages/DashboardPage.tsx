import {
  ArrowRight,
  CheckCircle2,
  Mail,
  Plus,
  ShieldCheck,
  Sparkles,
  Ticket,
  UserRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  getDisplayName,
  getRoleLabel,
} from '../domain/profile';
import { useAuth } from '../features/auth/use-auth';

export function DashboardPage() {
  const { profile, userEmail } = useAuth();

  if (!profile) {
    return (
      <div
        role="status"
        className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600"
      >
        Cargando los datos de tu perfil…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-6 py-8 text-white sm:px-8 sm:py-10">
          <p className="text-sm font-medium text-blue-300">Panel principal</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Hola, {profile.nombres}.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Tu sesión está activa y tu perfil fue verificado. Desde aquí puedes
            registrar incidencias, consultar la bandeja y gestionar el ciclo de
            vida de cada ticket.
          </p>
          <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-blue-100 ring-1 ring-inset ring-white/15">
            <CheckCircle2 className="size-4 text-emerald-400" aria-hidden="true" />
            Acceso autorizado como {getRoleLabel(profile.rol).toLowerCase()}
          </span>
        </div>

        <div className="grid gap-6 px-6 py-6 sm:px-8 sm:py-8 lg:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Datos del técnico
            </h2>
            <dl className="mt-4 space-y-4">
              <div className="flex items-start gap-3">
                <UserRound
                  className="mt-0.5 size-5 shrink-0 text-slate-400"
                  aria-hidden="true"
                />
                <div>
                  <dt className="text-xs font-medium text-slate-500">
                    Nombre completo
                  </dt>
                  <dd className="text-sm font-medium text-slate-900">
                    {getDisplayName(profile)}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail
                  className="mt-0.5 size-5 shrink-0 text-slate-400"
                  aria-hidden="true"
                />
                <div>
                  <dt className="text-xs font-medium text-slate-500">
                    Correo institucional
                  </dt>
                  <dd className="break-all text-sm font-medium text-slate-900">
                    {userEmail ?? 'No disponible'}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <ShieldCheck
                  className="mt-0.5 size-5 shrink-0 text-slate-400"
                  aria-hidden="true"
                />
                <div>
                  <dt className="text-xs font-medium text-slate-500">
                    Rol y estado
                  </dt>
                  <dd className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                    <span>{getRoleLabel(profile.rol)}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                      <span
                        className="size-1.5 rounded-full bg-emerald-500"
                        aria-hidden="true"
                      />
                      Cuenta activa
                    </span>
                  </dd>
                </div>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-5">
            <h2 className="text-sm font-semibold text-blue-950">
              Estado del acceso
            </h2>
            <p className="mt-2 text-sm leading-6 text-blue-900">
              La autenticación se completó correctamente. El perfil se consultó
              desde PostgreSQL y las políticas RLS limitan la lectura según tu
              rol y tus permisos.
            </p>
            <p className="mt-3 text-xs leading-5 text-blue-800">
              Ningún rol enviado por el navegador se usa para autorizar
              operaciones. La identidad y el técnico asignado se derivan de la
              sesión autenticada.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Operación de tickets
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Los tickets se crean antes de atender la incidencia. La bandeja
              concentra la cola de trabajo del equipo.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Link
            to="/tickets"
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <Ticket className="size-5" aria-hidden="true" />
              </div>
              <ArrowRight
                className="size-5 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-600"
                aria-hidden="true"
              />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">
              Bandeja de tickets
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Consulta la cola, filtra por estado y categoría, y abre el detalle
              de cada incidencia.
            </p>
          </Link>

          {profile.rol === 'admin' || profile.rol === 'tecnico' ? (
            <Link
              to="/tickets/nuevo"
              className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <Plus className="size-5" aria-hidden="true" />
                </div>
                <ArrowRight
                  className="size-5 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-600"
                  aria-hidden="true"
                />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-slate-900">
                Registrar ticket
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Alta manual de una incidencia con categoría, solicitante y canal
                de origen. El ticket inicia en estado Nuevo.
              </p>
            </Link>
          ) : (
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <ShieldCheck className="size-5" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-slate-900">
                Lectura administrativa
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Tu perfil puede consultar los tickets del equipo. La toma,
                resolución y cierre corresponden a los técnicos activos.
              </p>
            </article>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">
            Ciclo de vida
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Nuevo → En atención → Resuelto → Cerrado. Un ticket resuelto o
            cerrado puede reabrirse y volver a la cola. Cada transición queda
            registrada con su actor en un historial inmutable.
          </p>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Próximas fases
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Capacidades previstas que todavía no están disponibles.
            </p>
          </div>
          <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600">
            Próximamente
          </span>
        </div>

        <article className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
              <Sparkles className="size-5" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">
              Asistencia con IA
            </h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Borrador editable que el técnico revisa y confirma antes de guardar.
            La IA no crea tickets de forma autónoma y no tiene acceso
            administrativo a la base de datos.
          </p>
        </article>
      </section>
    </div>
  );
}
