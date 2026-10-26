export type SupabaseConfig = {
  url: string;
  publishableKey: string;
};

export type SupabaseConfigResult =
  | { ok: true; config: SupabaseConfig }
  | { ok: false; problems: string[] };

export type SupabaseEnvSource = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
};

const URL_PROBLEM =
  'VITE_SUPABASE_URL no es una URL http(s) válida.';
const MISSING_URL =
  'Falta VITE_SUPABASE_URL en frontend/.env.local.';
const MISSING_KEY =
  'Falta VITE_SUPABASE_PUBLISHABLE_KEY en frontend/.env.local.';
const SECRET_KEY =
  'VITE_SUPABASE_PUBLISHABLE_KEY parece una clave secreta o service_role. Usa solo la clave publicable (o anon).';

/**
 * Lee y valida la configuración pública de Supabase.
 * No registra ni devuelve los valores en los mensajes de error.
 */
export function readSupabaseConfig(
  source: SupabaseEnvSource = import.meta.env,
): SupabaseConfigResult {
  const url = source.VITE_SUPABASE_URL?.trim() ?? '';
  const publishableKey = source.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
  const problems: string[] = [];

  if (!url) {
    problems.push(MISSING_URL);
  } else if (!isHttpUrl(url)) {
    problems.push(URL_PROBLEM);
  }

  if (!publishableKey) {
    problems.push(MISSING_KEY);
  } else if (looksLikePrivilegedKey(publishableKey)) {
    problems.push(SECRET_KEY);
  }

  if (problems.length > 0) {
    return { ok: false, problems };
  }

  return { ok: true, config: { url, publishableKey } };
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function looksLikePrivilegedKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) {
    return true;
  }

  const parts = key.split('.');
  if (parts.length !== 3) {
    return false;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as {
      role?: unknown;
    };
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (normalized.length % 4)) % 4;
  return atob(normalized.padEnd(normalized.length + padding, '='));
}
