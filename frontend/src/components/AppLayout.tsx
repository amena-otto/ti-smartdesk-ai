import { useState } from 'react';
import {
  LayoutDashboard,
  LogOut,
  Plus,
  ShieldCheck,
  Ticket,
  BarChart3,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  getDisplayName,
  getRoleLabel,
} from '../domain/profile';
import { useAuth } from '../features/auth/use-auth';

export function AppLayout() {
  const { profile, userEmail, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const displayName = profile
    ? getDisplayName(profile)
    : (userEmail ?? 'Usuario');

  async function handleSignOut() {
    if (signingOut) {
      return;
    }

    setSigningOut(true);
    setSignOutError(null);

    const result = await signOut();

    if (!result.ok) {
      setSignOutError(result.message ?? 'No se pudo cerrar la sesión.');
      setSigningOut(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-slate-900">
                TI SmartDesk AI
              </p>
              <p className="text-xs text-slate-500">
                Soporte técnico institucional
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
            <div className="min-w-0 text-left sm:text-right">
              <p className="truncate text-sm font-medium text-slate-900">
                {displayName}
              </p>
              <p className="truncate text-xs text-slate-500">
                {profile ? getRoleLabel(profile.rol) : 'Perfil'}
                {userEmail ? ` · ${userEmail}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut className="size-4" aria-hidden="true" />
              {signingOut ? 'Cerrando…' : 'Cerrar sesión'}
            </button>
          </div>
        </div>

        <nav
          aria-label="Navegación principal"
          className="mx-auto flex w-full max-w-6xl gap-6 overflow-x-auto px-4 sm:px-6"
        >
          {profile?.rol === 'admin' ? (
            <NavLink
              to="/reportes"
              className={({ isActive }) => `inline-flex shrink-0 items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition ${isActive ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'}`}
            >
              <BarChart3 className="size-4" aria-hidden="true" />
              Reportes
            </NavLink>
          ) : null}
          <NavLink
            to="/dashboard"
            end
            className={({ isActive }) =>
              `inline-flex shrink-0 items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition ${
                isActive
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`
            }
          >
            <LayoutDashboard className="size-4" aria-hidden="true" />
            Panel
          </NavLink>
          <NavLink
            to="/tickets"
            className={({ isActive }) =>
              `inline-flex shrink-0 items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition ${
                isActive
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`
            }
          >
            <Ticket className="size-4" aria-hidden="true" />
            Tickets
          </NavLink>
          {profile?.rol === 'admin' || profile?.rol === 'tecnico' ? (
            <NavLink
              to="/tickets/nuevo"
              end
              className={({ isActive }) =>
                `inline-flex shrink-0 items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition ${
                  isActive
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`
              }
            >
              <Plus className="size-4" aria-hidden="true" />
              Nuevo ticket
            </NavLink>
          ) : null}
        </nav>

        {signOutError ? (
          <div className="border-t border-red-100 bg-red-50">
            <p
              role="alert"
              className="mx-auto w-full max-w-6xl px-4 py-2 text-sm text-red-700 sm:px-6"
            >
              {signOutError}
            </p>
          </div>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:py-12">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-4 text-xs text-slate-500 sm:px-6">
          Acceso restringido al personal de TI autorizado.
          {profile ? ` · Sesión de ${getDisplayName(profile)}` : ''}
        </div>
      </footer>
    </div>
  );
}
