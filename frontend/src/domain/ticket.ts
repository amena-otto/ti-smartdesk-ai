import type { Profile } from './profile';

export const TICKET_ESTADOS = [
  'nuevo',
  'en_atencion',
  'resuelto',
  'cerrado',
  'reabierto',
] as const;

export type TicketEstado = (typeof TICKET_ESTADOS)[number];

export const SOLICITANTE_TIPOS = [
  'estudiante',
  'docente',
  'administrativo',
] as const;

export type SolicitanteTipo = (typeof SOLICITANTE_TIPOS)[number];

export const CANALES_ORIGEN = [
  'manual',
  'ia',
  'whatsapp',
  'correo',
] as const;

export type CanalOrigen = (typeof CANALES_ORIGEN)[number];

export const CANALES_MANUALES = ['manual', 'whatsapp', 'correo'] as const;

export type CanalManual = (typeof CANALES_MANUALES)[number];

export const TICKET_ACCIONES = [
  'creado',
  'tomado',
  'iniciado',
  'resuelto',
  'cerrado',
  'reabierto',
] as const;

export type TicketAccion = (typeof TICKET_ACCIONES)[number];

export const TICKET_LIMITS = {
  asuntoMin: 3,
  asuntoMax: 150,
  descripcionMin: 5,
  descripcionMax: 4000,
  solicitanteNombreMin: 2,
  solicitanteNombreMax: 150,
  ubicacionMax: 200,
  solucionMin: 5,
  solucionMax: 4000,
  motivoMax: 1000,
} as const;

export type Ticket = {
  id: string;
  numeroTicket: string;
  asunto: string;
  descripcion: string;
  categoriaId: string;
  categoriaNombre: string | null;
  solicitanteNombre: string;
  solicitanteTipo: SolicitanteTipo;
  ubicacion: string | null;
  canalOrigen: CanalOrigen;
  estado: TicketEstado;
  tecnicoAsignadoId: string | null;
  tecnicoAsignadoNombre: string | null;
  solucion: string | null;
  fechaCreacion: string;
  fechaInicioAtencion: string | null;
  fechaResolucion: string | null;
  fechaCierre: string | null;
  createdBy: string | null;
};

export type TicketHistorialItem = {
  id: string;
  ticketId: string;
  accion: TicketAccion;
  estadoAnterior: TicketEstado | null;
  estadoNuevo: TicketEstado;
  actorId: string;
  actorNombre: string | null;
  detalle: string | null;
  creadoEn: string;
};

export type Categoria = {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
};

export type NuevoTicketInput = {
  asunto: string;
  descripcion: string;
  categoriaId: string;
  solicitanteNombre: string;
  solicitanteTipo: SolicitanteTipo;
  ubicacion: string;
  canalOrigen: CanalManual;
};

export type NuevoTicketErrores = Partial<
  Record<keyof NuevoTicketInput, string>
>;

export type TicketPermisos = {
  tomar: boolean;
  iniciar: boolean;
  resolver: boolean;
  cerrar: boolean;
  reabrir: boolean;
};

export function isTicketEstado(value: unknown): value is TicketEstado {
  return (
    typeof value === 'string' &&
    (TICKET_ESTADOS as readonly string[]).includes(value)
  );
}

export function isSolicitanteTipo(value: unknown): value is SolicitanteTipo {
  return (
    typeof value === 'string' &&
    (SOLICITANTE_TIPOS as readonly string[]).includes(value)
  );
}

export function isCanalOrigen(value: unknown): value is CanalOrigen {
  return (
    typeof value === 'string' &&
    (CANALES_ORIGEN as readonly string[]).includes(value)
  );
}

export function isCanalManual(value: unknown): value is CanalManual {
  return (
    typeof value === 'string' &&
    (CANALES_MANUALES as readonly string[]).includes(value)
  );
}

export function isTicketAccion(value: unknown): value is TicketAccion {
  return (
    typeof value === 'string' &&
    (TICKET_ACCIONES as readonly string[]).includes(value)
  );
}

export function getEstadoLabel(estado: TicketEstado): string {
  switch (estado) {
    case 'nuevo':
      return 'Nuevo';
    case 'en_atencion':
      return 'En atención';
    case 'resuelto':
      return 'Resuelto';
    case 'cerrado':
      return 'Cerrado';
    case 'reabierto':
      return 'Reabierto';
  }
}

export function getSolicitanteTipoLabel(tipo: SolicitanteTipo): string {
  switch (tipo) {
    case 'estudiante':
      return 'Estudiante';
    case 'docente':
      return 'Docente';
    case 'administrativo':
      return 'Administrativo';
  }
}

export function getCanalOrigenLabel(canal: CanalOrigen): string {
  switch (canal) {
    case 'manual':
      return 'Manual';
    case 'ia':
      return 'IA';
    case 'whatsapp':
      return 'WhatsApp';
    case 'correo':
      return 'Correo';
  }
}

export function getAccionLabel(accion: TicketAccion): string {
  switch (accion) {
    case 'creado':
      return 'Ticket creado';
    case 'tomado':
      return 'Ticket tomado';
    case 'iniciado':
      return 'Atención iniciada';
    case 'resuelto':
      return 'Ticket resuelto';
    case 'cerrado':
      return 'Ticket cerrado';
    case 'reabierto':
      return 'Ticket reabierto';
  }
}

export function getTicketPermisos(
  ticket: Ticket,
  profile: Pick<Profile, 'id' | 'rol'>,
): TicketPermisos {
  const esTecnico = profile.rol === 'tecnico';
  const asignadoAMi = ticket.tecnicoAsignadoId === profile.id;
  const enCola = ticket.estado === 'nuevo' || ticket.estado === 'reabierto';

  return {
    tomar: esTecnico && enCola && ticket.tecnicoAsignadoId === null,
    iniciar: esTecnico && enCola && asignadoAMi,
    resolver: esTecnico && ticket.estado === 'en_atencion' && asignadoAMi,
    cerrar: esTecnico && ticket.estado === 'resuelto' && asignadoAMi,
    reabrir:
      esTecnico &&
      (ticket.estado === 'resuelto' || ticket.estado === 'cerrado'),
  };
}

export function normalizeOptionalText(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function validateNuevoTicket(
  input: NuevoTicketInput,
): NuevoTicketErrores {
  const errors: NuevoTicketErrores = {};
  const asunto = input.asunto.trim();
  const descripcion = input.descripcion.trim();
  const nombre = input.solicitanteNombre.trim();
  const ubicacion = input.ubicacion.trim();

  if (
    asunto.length < TICKET_LIMITS.asuntoMin ||
    asunto.length > TICKET_LIMITS.asuntoMax
  ) {
    errors.asunto = `El asunto debe tener entre ${TICKET_LIMITS.asuntoMin} y ${TICKET_LIMITS.asuntoMax} caracteres.`;
  }

  if (
    descripcion.length < TICKET_LIMITS.descripcionMin ||
    descripcion.length > TICKET_LIMITS.descripcionMax
  ) {
    errors.descripcion = `La descripción debe tener entre ${TICKET_LIMITS.descripcionMin} y ${TICKET_LIMITS.descripcionMax} caracteres.`;
  }

  if (!input.categoriaId) {
    errors.categoriaId = 'Selecciona una categoría.';
  }

  if (
    nombre.length < TICKET_LIMITS.solicitanteNombreMin ||
    nombre.length > TICKET_LIMITS.solicitanteNombreMax
  ) {
    errors.solicitanteNombre = `El nombre debe tener entre ${TICKET_LIMITS.solicitanteNombreMin} y ${TICKET_LIMITS.solicitanteNombreMax} caracteres.`;
  }

  if (!isSolicitanteTipo(input.solicitanteTipo)) {
    errors.solicitanteTipo = 'Selecciona un tipo de solicitante válido.';
  }

  if (ubicacion.length > TICKET_LIMITS.ubicacionMax) {
    errors.ubicacion = `La ubicación no puede superar ${TICKET_LIMITS.ubicacionMax} caracteres.`;
  }

  if (!isCanalManual(input.canalOrigen)) {
    errors.canalOrigen = 'Selecciona un canal de origen válido.';
  }

  return errors;
}

export function hasValidationErrors(errors: NuevoTicketErrores): boolean {
  return Object.values(errors).some((message) => Boolean(message));
}

export function validateSolucion(solucion: string): string | null {
  const normalized = solucion.trim();

  if (normalized.length < TICKET_LIMITS.solucionMin) {
    return `La solución debe tener al menos ${TICKET_LIMITS.solucionMin} caracteres.`;
  }

  if (normalized.length > TICKET_LIMITS.solucionMax) {
    return `La solución no puede superar ${TICKET_LIMITS.solucionMax} caracteres.`;
  }

  return null;
}

export function validateMotivoReapertura(motivo: string): string | null {
  if (motivo.trim().length > TICKET_LIMITS.motivoMax) {
    return `El motivo no puede superar ${TICKET_LIMITS.motivoMax} caracteres.`;
  }

  return null;
}

export function formatTicketDate(value: string | null): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `ticket-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
