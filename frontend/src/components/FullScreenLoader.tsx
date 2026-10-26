import { LoaderCircle } from 'lucide-react';

type FullScreenLoaderProps = {
  message?: string;
};

export function FullScreenLoader({
  message = 'Cargando…',
}: FullScreenLoaderProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
      >
        <LoaderCircle
          className="size-5 animate-spin text-blue-600"
          aria-hidden="true"
        />
        <span className="text-sm font-medium text-slate-700">{message}</span>
      </div>
    </div>
  );
}
