import { getEstadoLabel, type TicketEstado } from '../../domain/ticket';

const ESTADO_STYLES: Record<TicketEstado, string> = {
  nuevo: 'bg-blue-50 text-blue-700 ring-blue-200',
  en_atencion: 'bg-amber-50 text-amber-800 ring-amber-200',
  resuelto: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cerrado: 'bg-slate-100 text-slate-700 ring-slate-300',
  reabierto: 'bg-purple-50 text-purple-700 ring-purple-200',
};

export function TicketStatusBadge({ estado }: { estado: TicketEstado }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${ESTADO_STYLES[estado]}`}
    >
      {getEstadoLabel(estado)}
    </span>
  );
}
