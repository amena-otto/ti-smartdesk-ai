import {
  isCanalOrigen,
  isSolicitanteTipo,
  isTicketAccion,
  isTicketEstado,
  type Categoria,
  type Ticket,
  type TicketHistorialItem,
} from './ticket';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requireString(
  row: Record<string, unknown>,
  key: string,
  message: string,
): string {
  const value = row[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(message);
  }

  return value;
}

function optionalString(
  row: Record<string, unknown>,
  key: string,
): string | null {
  const value = row[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function requireBoolean(
  row: Record<string, unknown>,
  key: string,
  message: string,
): boolean {
  const value = row[key];

  if (typeof value !== 'boolean') {
    throw new Error(message);
  }

  return value;
}

function parseRelationName(value: unknown): string | null {
  const relation = Array.isArray(value) ? value[0] : value;

  if (!isRecord(relation)) {
    return null;
  }

  const nombres =
    typeof relation.nombres === 'string' ? relation.nombres.trim() : '';
  const apellidos =
    typeof relation.apellidos === 'string' ? relation.apellidos.trim() : '';
  const name = `${nombres} ${apellidos}`.trim();

  return name.length > 0 ? name : null;
}

function parseCategoriaNombre(value: unknown): string | null {
  const relation = Array.isArray(value) ? value[0] : value;

  if (!isRecord(relation)) {
    return null;
  }

  return typeof relation.nombre === 'string' && relation.nombre.trim().length > 0
    ? relation.nombre.trim()
    : null;
}

export function parseTicket(value: unknown): Ticket {
  if (!isRecord(value)) {
    throw new Error('El ticket recibido no es válido.');
  }

  const estado = value.estado;
  const solicitanteTipo = value.solicitante_tipo;
  const canalOrigen = value.canal_origen;

  if (!isTicketEstado(estado)) {
    throw new Error('El ticket tiene un estado no permitido.');
  }

  if (!isSolicitanteTipo(solicitanteTipo)) {
    throw new Error('El ticket tiene un tipo de solicitante no permitido.');
  }

  if (!isCanalOrigen(canalOrigen)) {
    throw new Error('El ticket tiene un canal de origen no permitido.');
  }

  return {
    id: requireString(value, 'id', 'El ticket no tiene un identificador válido.'),
    numeroTicket: requireString(
      value,
      'numero_ticket',
      'El ticket no tiene un número válido.',
    ),
    asunto: requireString(value, 'asunto', 'El ticket no tiene asunto.'),
    descripcion: requireString(
      value,
      'descripcion',
      'El ticket no tiene descripción.',
    ),
    categoriaId: requireString(
      value,
      'categoria_id',
      'El ticket no tiene categoría.',
    ),
    categoriaNombre: parseCategoriaNombre(value.categoria),
    solicitanteNombre: requireString(
      value,
      'solicitante_nombre',
      'El ticket no tiene nombre de solicitante.',
    ),
    solicitanteTipo,
    solicitanteDni: optionalString(value, 'solicitante_dni'),
    solicitanteCorreo: optionalString(value, 'solicitante_correo'),
    ubicacion: optionalString(value, 'ubicacion'),
    canalOrigen,
    estado,
    tecnicoAsignadoId: optionalString(value, 'tecnico_asignado_id'),
    tecnicoAsignadoNombre: parseRelationName(value.tecnico),
    solucion: optionalString(value, 'solucion'),
    fechaCreacion: requireString(
      value,
      'fecha_creacion',
      'El ticket no tiene fecha de creación.',
    ),
    fechaInicioAtencion: optionalString(value, 'fecha_inicio_atencion'),
    fechaResolucion: optionalString(value, 'fecha_resolucion'),
    fechaCierre: optionalString(value, 'fecha_cierre'),
    createdBy: optionalString(value, 'created_by'),
  };
}

export function parseTicketList(value: unknown): Ticket[] {
  if (!Array.isArray(value)) {
    throw new Error('La lista de tickets recibida no es válida.');
  }

  return value.map(parseTicket);
}

export function parseMaybeTicket(value: unknown): Ticket | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? parseTicket(value[0]) : null;
  }

  return parseTicket(value);
}

export function parseCategoria(value: unknown): Categoria {
  if (!isRecord(value)) {
    throw new Error('La categoría recibida no es válida.');
  }

  return {
    id: requireString(value, 'id', 'La categoría no tiene identificador.'),
    nombre: requireString(value, 'nombre', 'La categoría no tiene nombre.'),
    descripcion: optionalString(value, 'descripcion'),
    activo: requireBoolean(
      value,
      'activo',
      'La categoría no tiene un estado válido.',
    ),
  };
}

export function parseCategoriaList(value: unknown): Categoria[] {
  if (!Array.isArray(value)) {
    throw new Error('La lista de categorías recibida no es válida.');
  }

  return value.map(parseCategoria);
}

export function parseTicketHistorialItem(value: unknown): TicketHistorialItem {
  if (!isRecord(value)) {
    throw new Error('El registro de historial recibido no es válido.');
  }

  const accion = value.accion;
  const estadoAnterior = value.estado_anterior;
  const estadoNuevo = value.estado_nuevo;
  const rawId = value.id;

  if (!isTicketAccion(accion)) {
    throw new Error('El historial tiene una acción no permitida.');
  }

  if (estadoAnterior !== null && !isTicketEstado(estadoAnterior)) {
    throw new Error('El historial tiene un estado anterior no permitido.');
  }

  if (!isTicketEstado(estadoNuevo)) {
    throw new Error('El historial tiene un estado nuevo no permitido.');
  }

  if (typeof rawId !== 'string' && typeof rawId !== 'number') {
    throw new Error('El historial no tiene un identificador válido.');
  }

  return {
    id: String(rawId),
    ticketId: requireString(
      value,
      'ticket_id',
      'El historial no tiene ticket asociado.',
    ),
    accion,
    estadoAnterior,
    estadoNuevo,
    actorId: optionalString(value, 'actor_id'),
    actorNombre: parseRelationName(value.actor),
    detalle: optionalString(value, 'detalle'),
    creadoEn: requireString(
      value,
      'creado_en',
      'El historial no tiene fecha.',
    ),
  };
}

export function parseTicketHistorialList(value: unknown): TicketHistorialItem[] {
  if (!Array.isArray(value)) {
    throw new Error('La lista de historial recibida no es válida.');
  }

  return value.map(parseTicketHistorialItem);
}
