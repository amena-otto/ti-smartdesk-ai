import {
  normalizeOptionalText,
  type Categoria,
  type NuevoTicketInput,
  type Ticket,
  type TicketEstado,
  type TicketHistorialItem,
} from '../../domain/ticket';
import {
  parseCategoriaList,
  parseMaybeTicket,
  parseTicket,
  parseTicketHistorialList,
  parseTicketList,
} from '../../domain/ticket-parse';
import { requireSupabase } from '../../lib/supabase';
import { mapTicketError } from './ticket-errors';

export type TicketResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

export type TicketFilters = {
  estado: TicketEstado | 'todos';
  categoriaId: string | 'todas';
};

type SupabaseResponse = {
  data: unknown;
  error: unknown;
};

const TICKET_SELECT = `
  id,
  numero_ticket,
  asunto,
  descripcion,
  categoria_id,
  categoria:catalogo_categorias!tickets_categoria_id_fkey(nombre),
  solicitante_nombre,
  solicitante_tipo,
  solicitante_dni,
  solicitante_correo,
  ubicacion,
  canal_origen,
  estado,
  tecnico_asignado_id,
  tecnico:profiles!tickets_tecnico_asignado_id_fkey(nombres, apellidos),
  solucion,
  fecha_creacion,
  fecha_inicio_atencion,
  fecha_resolucion,
  fecha_cierre,
  created_by
`;

const HISTORIAL_SELECT = `
  id,
  ticket_id,
  accion,
  estado_anterior,
  estado_nuevo,
  actor_id,
  actor:profiles!ticket_historial_actor_id_fkey(nombres, apellidos),
  detalle,
  creado_en
`;

function parseRequiredTicket(data: unknown): Ticket {
  const ticket = parseMaybeTicket(data);

  if (!ticket) {
    throw new Error('El servidor no devolvió el ticket solicitado.');
  }

  return ticket;
}

async function execute<T>(
  operation: () => Promise<SupabaseResponse>,
  parse: (data: unknown) => T,
): Promise<TicketResult<T>> {
  try {
    const { data, error } = await operation();

    if (error) {
      return { ok: false, message: mapTicketError(error) };
    }

    try {
      return { ok: true, data: parse(data) };
    } catch (parseError) {
      return { ok: false, message: mapTicketError(parseError) };
    }
  } catch (error) {
    return { ok: false, message: mapTicketError(error) };
  }
}

/**
 * Ejecuta una RPC de transición y recarga el ticket con sus relaciones.
 * La RPC devuelve la fila de `tickets` sin los nombres de categoría y técnico
 * incrustados; sin esta recarga el detalle mostraría datos incompletos.
 */
async function executeTicketAction(
  ticketId: string,
  operation: () => Promise<SupabaseResponse>,
): Promise<TicketResult<Ticket>> {
  const result = await execute(operation, parseRequiredTicket);

  if (!result.ok) {
    return result;
  }

  const refreshed = await obtenerTicket(ticketId);

  return refreshed.ok && refreshed.data
    ? { ok: true, data: refreshed.data }
    : result;
}

export async function listarTickets(
  filters: TicketFilters,
): Promise<TicketResult<Ticket[]>> {
  return execute(async () => {
    let query = requireSupabase()
      .from('tickets')
      .select(TICKET_SELECT)
      .order('fecha_creacion', { ascending: false });

    if (filters.estado !== 'todos') {
      query = query.eq('estado', filters.estado);
    }

    if (filters.categoriaId !== 'todas') {
      query = query.eq('categoria_id', filters.categoriaId);
    }

    return query;
  }, parseTicketList);
}

export async function listarCategorias(): Promise<TicketResult<Categoria[]>> {
  return execute(
    async () =>
      requireSupabase()
        .from('catalogo_categorias')
        .select('id, nombre, descripcion, activo')
        .order('nombre', { ascending: true }),
    parseCategoriaList,
  );
}

export async function obtenerTicket(
  ticketId: string,
): Promise<TicketResult<Ticket | null>> {
  return execute(
    async () =>
      requireSupabase()
        .from('tickets')
        .select(TICKET_SELECT)
        .eq('id', ticketId)
        .maybeSingle(),
    parseMaybeTicket,
  );
}

export async function obtenerHistorial(
  ticketId: string,
): Promise<TicketResult<TicketHistorialItem[]>> {
  return execute(
    async () =>
      requireSupabase()
        .from('ticket_historial')
        .select(HISTORIAL_SELECT)
        .eq('ticket_id', ticketId)
        .order('creado_en', { ascending: true })
        .order('id', { ascending: true }),
    parseTicketHistorialList,
  );
}

export async function crearTicket(
  input: NuevoTicketInput,
  idempotencyKey: string,
): Promise<TicketResult<Ticket>> {
  return execute(
    async () =>
      requireSupabase().rpc('crear_ticket', {
        p_asunto: input.asunto.trim(),
        p_descripcion: input.descripcion.trim(),
        p_categoria_id: input.categoriaId,
        p_solicitante_nombre: input.solicitanteNombre.trim(),
        p_solicitante_tipo: input.solicitanteTipo,
        p_ubicacion: normalizeOptionalText(input.ubicacion),
        p_canal_origen: input.canalOrigen,
        p_clave_idempotencia: idempotencyKey,
      }),
    parseRequiredTicket,
  );
}

export async function tomarTicket(
  ticketId: string,
): Promise<TicketResult<Ticket>> {
  return executeTicketAction(
    ticketId,
    async () => requireSupabase().rpc('tomar_ticket', { p_ticket_id: ticketId }),
  );
}

export async function iniciarAtencion(
  ticketId: string,
): Promise<TicketResult<Ticket>> {
  return executeTicketAction(
    ticketId,
    async () =>
      requireSupabase().rpc('iniciar_atencion', { p_ticket_id: ticketId }),
  );
}

export async function resolverTicket(
  ticketId: string,
  solucion: string,
): Promise<TicketResult<Ticket>> {
  return executeTicketAction(
    ticketId,
    async () =>
      requireSupabase().rpc('resolver_ticket', {
        p_ticket_id: ticketId,
        p_solucion: solucion.trim(),
      }),
  );
}

export async function cerrarTicket(
  ticketId: string,
): Promise<TicketResult<Ticket>> {
  return executeTicketAction(
    ticketId,
    async () =>
      requireSupabase().rpc('cerrar_ticket', { p_ticket_id: ticketId }),
  );
}

export async function reabrirTicket(
  ticketId: string,
  motivo: string,
): Promise<TicketResult<Ticket>> {
  return executeTicketAction(
    ticketId,
    async () =>
      requireSupabase().rpc('reabrir_ticket', {
        p_ticket_id: ticketId,
        p_motivo: normalizeOptionalText(motivo),
      }),
  );
}

export { parseTicket };
