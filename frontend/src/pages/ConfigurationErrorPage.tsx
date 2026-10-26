import { AlertTriangle, ServerCrash, ShieldCheck } from 'lucide-react';

type ConfigurationErrorPageProps = {
  problems: string[];
};

export function ConfigurationErrorPage({
  problems,
}: ConfigurationErrorPageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            <ServerCrash className="size-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">TI SmartDesk AI</p>
            <p className="text-xs text-slate-400">Configuración incompleta</p>
          </div>
        </div>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          Falta configurar Supabase
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          La aplicación no puede iniciar sesión porque la configuración pública
          del proyecto no es válida. No se muestran valores sensibles.
        </p>

        <ul className="mt-5 space-y-2" role="alert">
          {problems.map((problem) => (
            <li
              key={problem}
              className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
            >
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>{problem}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 rounded-xl border border-slate-700 bg-slate-950/60 p-5">
          <h2 className="text-sm font-semibold text-white">Cómo resolverlo</h2>
          <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-300">
            <li>
              Crea{' '}
              <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200">
                frontend/.env.local
              </code>{' '}
              a partir de{' '}
              <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200">
                frontend/.env.example
              </code>
              .
            </li>
            <li>
              Completa{' '}
              <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200">
                VITE_SUPABASE_URL
              </code>{' '}
              y{' '}
              <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200">
                VITE_SUPABASE_PUBLISHABLE_KEY
              </code>{' '}
              con los valores públicos del proyecto Supabase.
            </li>
            <li>
              Reinicia el servidor de desarrollo para que Vite vuelva a leer las
              variables.
            </li>
            <li>
              Usa únicamente la clave publicable o <code>anon</code>. Nunca uses{' '}
              <code>service_role</code> ni una clave secreta en el navegador.
            </li>
          </ol>
        </div>

        <p className="mt-6 flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
          Consulta `supabase/README.md` para el aprovisionamiento y las
          migraciones.
        </p>
      </section>
    </main>
  );
}
