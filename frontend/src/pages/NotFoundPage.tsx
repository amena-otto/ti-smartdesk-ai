import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/use-auth';

export function NotFoundPage() {
  const { status } = useAuth();
  const isAuthenticated = status === 'authenticated';
  const destination = isAuthenticated ? '/dashboard' : '/login';
  const label = isAuthenticated ? 'Volver al panel' : 'Ir al inicio de sesión';

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          <AlertCircle className="size-6" aria-hidden="true" />
        </div>
        <p className="mt-5 text-sm font-semibold text-blue-600">Error 404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          Página no encontrada
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          La dirección que abriste no existe o ya no está disponible.
        </p>
        <Link
          to={destination}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {label}
        </Link>
      </section>
    </main>
  );
}
