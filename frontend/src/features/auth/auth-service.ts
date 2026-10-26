import type { Session } from '@supabase/supabase-js';
import { parseProfile, type Profile } from '../../domain/profile';
import { requireSupabase } from '../../lib/supabase';
import { mapSignInError } from './auth-errors';

export type SignInResult =
  | { ok: true; session: Session }
  | { ok: false; message: string };

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<SignInResult> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return {
      ok: false,
      message: 'Introduce tu correo institucional y tu contraseña.',
    };
  }

  const { data, error } = await requireSupabase().auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    return { ok: false, message: mapSignInError(error) };
  }

  if (!data.session) {
    return {
      ok: false,
      message: 'No se pudo iniciar la sesión. Inténtalo de nuevo.',
    };
  }

  return { ok: true, session: data.session };
}

/**
 * Cierra la sesión local incluso si el servidor no responde. La revocación
 * remota puede quedar pendiente hasta que expire el token, pero el navegador
 * deja de conservar la sesión.
 */
export async function signOutCurrentUser(): Promise<void> {
  const client = requireSupabase();

  try {
    const { error } = await client.auth.signOut();
    if (!error) {
      return;
    }
  } catch {
    // Se intenta el cierre local a continuación.
  }

  await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await requireSupabase().auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
}

export async function fetchOwnProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('id, nombres, apellidos, rol, activo, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? parseProfile(data) : null;
}

export function subscribeToAuthChanges(
  onChange: (session: Session | null) => void,
): () => void {
  const { data } = requireSupabase().auth.onAuthStateChange(
    (_event, session) => {
      onChange(session);
    },
  );

  return () => {
    data.subscription.unsubscribe();
  };
}
