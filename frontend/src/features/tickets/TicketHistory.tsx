import {
  formatTicketDate,
  getAccionLabel,
  getEstadoLabel,
  type TicketHistorialItem,
} from '../../domain/ticket';

export function TicketHistory({ items }: { items: TicketHistorialItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        Todavía no hay movimientos registrados para este ticket.
      </p>
    );
  }

  return (
    <ol className="space-y-5">
      {items.map((item) => (
        <li key={item.id} className="relative pl-6">
          <span
            className="absolute left-0 top-1.5 size-2.5 rounded-full border-2 border-white bg-blue-500 ring-1 ring-blue-200"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-slate-900">
              {getAccionLabel(item.accion)}
            </p>
            <p className="text-xs text-slate-500">
              {item.actorNombre ?? 'Sistema'} ·{' '}
              {formatTicketDate(item.creadoEn)}
            </p>
            {item.estadoAnterior && item.estadoAnterior !== item.estadoNuevo ? (
              <p className="text-xs text-slate-600">
                {getEstadoLabel(item.estadoAnterior)} →{' '}
                {getEstadoLabel(item.estadoNuevo)}
              </p>
            ) : null}
            {item.detalle ? (
              <p className="mt-2 whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
                {item.detalle}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
