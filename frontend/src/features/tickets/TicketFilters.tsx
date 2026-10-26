import {
  TICKET_ESTADOS,
  getEstadoLabel,
  type Categoria,
  type TicketEstado,
} from '../../domain/ticket';

type TicketFiltersProps = {
  estado: TicketEstado | 'todos';
  categoriaId: string;
  categorias: Categoria[];
  onEstadoChange: (estado: TicketEstado | 'todos') => void;
  onCategoriaChange: (categoriaId: string) => void;
  onClear: () => void;
};

export function TicketFilters({
  estado,
  categoriaId,
  categorias,
  onEstadoChange,
  onCategoriaChange,
  onClear,
}: TicketFiltersProps) {
  const hasFilters = estado !== 'todos' || categoriaId !== 'todas';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label
            htmlFor="filtro-estado"
            className="block text-sm font-medium text-slate-700"
          >
            Estado
          </label>
          <select
            id="filtro-estado"
            value={estado}
            onChange={(event) =>
              onEstadoChange(event.target.value as TicketEstado | 'todos')
            }
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="todos">Todos los estados</option>
            {TICKET_ESTADOS.map((value) => (
              <option key={value} value={value}>
                {getEstadoLabel(value)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label
            htmlFor="filtro-categoria"
            className="block text-sm font-medium text-slate-700"
          >
            Categoría
          </label>
          <select
            id="filtro-categoria"
            value={categoriaId}
            onChange={(event) => onCategoriaChange(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="todas">Todas las categorías</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nombre}
                {categoria.activo ? '' : ' (inactiva)'}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={onClear}
          disabled={!hasFilters}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Limpiar filtros
        </button>
      </div>
    </div>
  );
}
