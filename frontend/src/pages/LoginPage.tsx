import { useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../features/auth/use-auth';

export function LoginPage() {
  const { signIn, notice, clearNotice } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setError(null);
    clearNotice();
    setSubmitting(true);

    const result = await signIn(email, password);

    if (!result.ok) {
      setError(
        result.message ?? 'No se pudo iniciar sesión. Inténtalo de nuevo.',
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 lg:grid lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-10 py-12 lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div
          className="pointer-events-none absolute -right-24 top-1/4 size-96 rounded-full bg-blue-500/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative">
          <div className="inline-flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-950/40">
              <ShieldCheck className="size-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight text-white">
                TI SmartDesk AI
              </p>
              <p className="text-xs text-slate-400">
                Soporte técnico institucional
              </p>
            </div>
          </div>

          <h1 className="mt-14 max-w-md text-4xl font-semibold leading-tight tracking-tight text-white xl:text-5xl">
            Registro de atenciones resueltas, con control del técnico.
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-slate-300">
            Un espacio único para documentar el soporte brindado a la comunidad
            educativa. La asistencia de IA propone; el técnico confirma.
          </p>

          <ul className="mt-10 space-y-4">
            {[
              'Acceso exclusivo para personal autorizado.',
              'Identidad y permisos validados con Supabase Auth y RLS.',
              'Ningún ticket se guarda sin confirmación explícita.',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-slate-300">
                <CheckCircle2
                  className="mt-0.5 size-5 shrink-0 text-blue-400"
                  aria-hidden="true"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">
          TI SmartDesk AI · Institución educativa
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-base font-semibold tracking-tight text-slate-900">
                TI SmartDesk AI
              </p>
              <p className="text-xs text-slate-500">
                Soporte técnico institucional
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                Iniciar sesión
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Usa tu correo institucional y la contraseña asignada a tu cuenta
                de técnico.
              </p>
            </div>

            {notice ? (
              <div
                role="status"
                className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p>{notice}</p>
                    <button
                      type="button"
                      onClick={clearNotice}
                      className="mt-1 font-medium underline underline-offset-2 hover:text-amber-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {error ? (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700"
              >
                <AlertCircle
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <p>{error}</p>
              </div>
            ) : null}

            <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-slate-800"
                >
                  Correo institucional
                </label>
                <div className="relative mt-2">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    aria-invalid={error ? true : undefined}
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
                    placeholder="nombre@institucion.edu"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-800"
                >
                  Contraseña
                </label>
                <div className="relative mt-2">
                  <Lock
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-invalid={error ? true : undefined}
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-11 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
                    placeholder="Tu contraseña"
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={
                      showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                    }
                    className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                    disabled={submitting}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? (
                  <>
                    <LoaderCircle
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                    Verificando acceso…
                  </>
                ) : (
                  <>
                    Entrar al sistema
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500">
              El acceso está restringido al personal de TI autorizado. Si no
              puedes ingresar, contacta al administrador del sistema.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
