import { useState } from 'react';
import { AlertTriangle, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../features/auth/use-auth';

export function ProfileVerificationError() {
  const { profileError, retryProfile, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

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
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex size-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </div>

        <h1 className="mt-5 text-xl font-semibold text-slate-900">
          No se pudo verificar tu perfil
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {profileError ??
            'La sesión existe, pero no fue posible comprobar que tu cuenta esté autorizada.'}
        </p>

        {signOutError ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {signOutError}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={retryProfile}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Reintentar
          </button>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="size-4" aria-hidden="true" />
            {signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
        </div>
      </section>
    </main>
  );
}
