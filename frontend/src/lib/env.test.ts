import { describe, expect, it } from 'vitest';
import { readSupabaseConfig } from './env';

const validSource = {
  VITE_SUPABASE_URL: 'https://proyecto.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_clave_publica',
};

describe('readSupabaseConfig', () => {
  it('acepta una URL y una clave publicable válidas', () => {
    expect(readSupabaseConfig(validSource)).toEqual({
      ok: true,
      config: {
        url: 'https://proyecto.supabase.co',
        publishableKey: 'sb_publishable_clave_publica',
      },
    });
  });

  it('recorta espacios alrededor de los valores', () => {
    const result = readSupabaseConfig({
      VITE_SUPABASE_URL: '  https://proyecto.supabase.co  ',
      VITE_SUPABASE_PUBLISHABLE_KEY: '  clave-publica  ',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.url).toBe('https://proyecto.supabase.co');
      expect(result.config.publishableKey).toBe('clave-publica');
    }
  });

  it('informa ambas variables faltantes sin exponer valores', () => {
    const result = readSupabaseConfig({});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems).toHaveLength(2);
      expect(result.problems.join(' ')).toContain('VITE_SUPABASE_URL');
      expect(result.problems.join(' ')).toContain(
        'VITE_SUPABASE_PUBLISHABLE_KEY',
      );
    }
  });

  it('rechaza una URL que no es http o https', () => {
    const result = readSupabaseConfig({
      ...validSource,
      VITE_SUPABASE_URL: 'no-es-una-url',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems.join(' ')).toContain('URL');
    }
  });

  it('rechaza una clave secreta de Supabase', () => {
    const secret = 'sb_secret_no_debe_usarse_en_el_navegador';
    const result = readSupabaseConfig({
      ...validSource,
      VITE_SUPABASE_PUBLISHABLE_KEY: secret,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems.join(' ')).toContain('service_role');
      expect(result.problems.join(' ')).not.toContain(secret);
    }
  });

  it('rechaza un JWT con rol service_role', () => {
    const header = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
    const payload = 'eyJyb2xlIjoic2VydmljZV9yb2xlIn0';
    const token = `${header}.${payload}.firma-sintetica`;

    const result = readSupabaseConfig({
      ...validSource,
      VITE_SUPABASE_PUBLISHABLE_KEY: token,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems.join(' ')).not.toContain(token);
    }
  });

  it('acepta un JWT heredado con rol anon', () => {
    const header = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
    const payload = 'eyJyb2xlIjoiYW5vbiJ9';
    const token = `${header}.${payload}.firma-sintetica`;

    const result = readSupabaseConfig({
      ...validSource,
      VITE_SUPABASE_PUBLISHABLE_KEY: token,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.publishableKey).toBe(token);
    }
  });
});
