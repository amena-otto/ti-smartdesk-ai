import { describe, expect, it } from 'vitest';
import {
  mapProfileLoadError,
  mapSignInError,
  mapSignOutError,
} from './auth-errors';

describe('mapSignInError', () => {
  it('traduce credenciales inválidas sin confirmar la cuenta', () => {
    expect(
      mapSignInError({
        code: 'invalid_credentials',
        message: 'Invalid login credentials',
      }),
    ).toBe('Correo o contraseña incorrectos.');
  });

  it('distingue el correo sin confirmar', () => {
    expect(
      mapSignInError({
        code: 'email_not_confirmed',
        message: 'Email not confirmed',
      }),
    ).toContain('confirmado');
  });

  it('traduce el límite de intentos', () => {
    expect(mapSignInError({ status: 429 })).toContain('Demasiados intentos');
  });

  it('identifica un fallo de conexión', () => {
    expect(
      mapSignInError({
        name: 'AuthRetryableFetchError',
        status: 0,
        message: 'Failed to fetch',
      }),
    ).toContain('conexión');
  });

  it('no filtra detalles internos desconocidos', () => {
    const message = mapSignInError(
      new Error('database exploded with secret detail'),
    );

    expect(message).not.toContain('secret');
    expect(message).not.toContain('database');
  });
});

describe('mapProfileLoadError', () => {
  it('detecta una sesión vencida', () => {
    expect(mapProfileLoadError({ status: 401 })).toContain('sesión venció');
  });

  it('distingue un fallo de conexión', () => {
    expect(
      mapProfileLoadError({
        name: 'AuthRetryableFetchError',
        message: 'Failed to fetch',
      }),
    ).toContain('conexión');
  });

  it('oculta detalles internos', () => {
    const message = mapProfileLoadError(new Error('row level security detail'));

    expect(message).not.toContain('row level security');
  });
});

describe('mapSignOutError', () => {
  it('devuelve un mensaje estable', () => {
    expect(mapSignOutError()).toContain('cerrar la sesión');
  });
});
