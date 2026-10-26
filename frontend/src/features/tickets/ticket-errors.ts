const GENERIC_TICKET_ERROR =
  'No se pudo completar la operación con tickets. Inténtalo de nuevo.';

const MIGRATION_ERROR =
  'El módulo de tickets no está disponible todavía. Verifica que las migraciones se hayan aplicado en Supabase.';

const TOKEN_MESSAGES: Record<string, string> = {
  no_autenticado:
    'Tu sesión no es válida o venció. Vuelve a iniciar sesión para continuar.',
  perfil_inactivo:
    'Tu cuenta no está activa para operar tickets. Consulta con el administrador.',
  datos_invalidos:
    'Algunos datos no son válidos. Revisa los campos e inténtalo de nuevo.',
  categoria_inactiva:
    'La categoría seleccionada ya no está activa. Elige otra categoría.',
  ticket_no_encontrado:
    'El ticket no existe o no tienes permiso para consultarlo.',
  transicion_invalida:
    'El ticket cambió de estado. Actualiza la vista antes de volver a intentarlo.',
  ticket_ya_tomado:
    'Otro técnico tomó este ticket mientras lo consultabas. Actualiza la vista.',
  sin_asignacion:
    'La operación requiere que el ticket esté asignado a tu usuario.',
  solucion_requerida:
    'La solución es obligatoria para resolver el ticket.',
  duplicate_request_conflict:
    'La operación se repitió con datos distintos. Actualiza la vista e inténtalo de nuevo.',
  historial_inmutable: 'El historial no se puede modificar.',
  ticket_no_eliminable: 'Los tickets no se eliminan físicamente.',
};

type ErrorDetails = {
  code: string;
  status: number | undefined;
  message: string;
  details: string;
  hint: string;
};

function getErrorDetails(error: unknown): ErrorDetails | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const value = error as Record<string, unknown>;

  return {
    code: typeof value.code === 'string' ? value.code : '',
    status: typeof value.status === 'number' ? value.status : undefined,
    message:
      typeof value.message === 'string' ? value.message.toLowerCase() : '',
    details:
      typeof value.details === 'string' ? value.details.toLowerCase() : '',
    hint: typeof value.hint === 'string' ? value.hint.toLowerCase() : '',
  };
}

function isConnectionError(details: ErrorDetails): boolean {
  return (
    details.status === 0 ||
    details.message.includes('failed to fetch') ||
    details.message.includes('network') ||
    details.message.includes('fetch failed')
  );
}

function isMissingModuleError(details: ErrorDetails): boolean {
  return (
    details.code === 'PGRST202' ||
    details.code === '42P01' ||
    details.message.includes('could not find the function') ||
    details.message.includes('schema cache') ||
    details.message.includes('does not exist')
  );
}

/**
 * Traduce errores de Supabase y de las RPC a mensajes accionables sin exponer
 * detalles internos de PostgreSQL.
 */
export function mapTicketError(error: unknown): string {
  const details = getErrorDetails(error);

  if (!details) {
    return GENERIC_TICKET_ERROR;
  }

  const haystack = `${details.message} ${details.details} ${details.hint}`;

  for (const [token, message] of Object.entries(TOKEN_MESSAGES)) {
    if (haystack.includes(token)) {
      return message;
    }
  }

  if (
    details.status === 401 ||
    details.code === 'PGRST301' ||
    details.code === '42501'
  ) {
    return 'Tu sesión venció o no tienes permisos para esta operación. Vuelve a iniciar sesión.';
  }

  if (isMissingModuleError(details)) {
    return MIGRATION_ERROR;
  }

  if (isConnectionError(details)) {
    return 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
  }

  return GENERIC_TICKET_ERROR;
}
