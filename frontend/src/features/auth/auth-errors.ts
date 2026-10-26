const GENERIC_SIGN_IN_ERROR =
  'No se pudo iniciar sesión. Inténtalo de nuevo o consulta con el administrador.';
const GENERIC_PROFILE_ERROR =
  'No se pudo verificar tu perfil. Revisa tu conexión e inténtalo de nuevo.';
const GENERIC_SIGN_OUT_ERROR =
  'No se pudo cerrar la sesión. Inténtalo de nuevo.';

type ErrorDetails = {
  code: string;
  name: string;
  status: number | undefined;
  message: string;
};

function getErrorDetails(error: unknown): ErrorDetails | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const value = error as Record<string, unknown>;

  return {
    code: typeof value.code === 'string' ? value.code : '',
    name: typeof value.name === 'string' ? value.name : '',
    status: typeof value.status === 'number' ? value.status : undefined,
    message: typeof value.message === 'string' ? value.message.toLowerCase() : '',
  };
}

function isConnectionError(details: ErrorDetails): boolean {
  return (
    details.name === 'AuthRetryableFetchError' ||
    details.status === 0 ||
    details.message.includes('failed to fetch') ||
    details.message.includes('network')
  );
}

/**
 * Traduce errores de autenticación a mensajes accionables sin revelar
 * detalles internos ni confirmar la existencia de una cuenta.
 */
export function mapSignInError(error: unknown): string {
  const details = getErrorDetails(error);

  if (!details) {
    return GENERIC_SIGN_IN_ERROR;
  }

  if (
    details.code === 'invalid_credentials' ||
    details.message.includes('invalid login credentials')
  ) {
    return 'Correo o contraseña incorrectos.';
  }

  if (
    details.code === 'email_not_confirmed' ||
    details.message.includes('email not confirmed')
  ) {
    return 'La cuenta todavía no ha confirmado el correo institucional.';
  }

  if (
    details.code === 'over_request_rate_limit' ||
    details.code === 'too_many_requests' ||
    details.status === 429
  ) {
    return 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.';
  }

  if (isConnectionError(details)) {
    return 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
  }

  return GENERIC_SIGN_IN_ERROR;
}

export function mapProfileLoadError(error: unknown): string {
  const details = getErrorDetails(error);

  if (!details) {
    return GENERIC_PROFILE_ERROR;
  }

  if (
    details.status === 401 ||
    details.code === 'PGRST301' ||
    details.name === 'AuthSessionMissingError'
  ) {
    return 'Tu sesión venció. Vuelve a iniciar sesión.';
  }

  if (isConnectionError(details)) {
    return 'No se pudo conectar con el servidor para verificar tu perfil. Revisa tu conexión e inténtalo de nuevo.';
  }

  return GENERIC_PROFILE_ERROR;
}

export function mapSignOutError(): string {
  return GENERIC_SIGN_OUT_ERROR;
}
