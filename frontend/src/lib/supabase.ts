import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readSupabaseConfig } from './env';

const configResult = readSupabaseConfig();

export const supabaseConfigProblems: string[] = configResult.ok
  ? []
  : configResult.problems;

/**
 * Cliente público de Supabase. Es null cuando falta configuración; en ese caso
 * la aplicación muestra una pantalla de configuración en lugar de fallar en blanco.
 */
export const supabase: SupabaseClient | null = configResult.ok
  ? createClient(configResult.config.url, configResult.config.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Supabase no está configurado.');
  }

  return supabase;
}
