import { describe, expect, it } from 'vitest';
import { mapTicketError } from './ticket-errors';

describe('mapTicketError', () => {
  it('traduce tokens de error de las RPC', () => {
    expect(
      mapTicketError({ message: 'ticket_ya_tomado' }),
    ).toContain('Otro técnico');

    expect(
      mapTicketError({ message: 'sin_asignacion' }),
    ).toContain('asignado a tu usuario');

    expect(
      mapTicketError({ message: 'transicion_invalida' }),
    ).toContain('cambió de estado');

    expect(
      mapTicketError({ message: 'solucion_requerida' }),
    ).toContain('solución es obligatoria');

    expect(
      mapTicketError({ message: 'categoria_inactiva' }),
    ).toContain('ya no está activa');

    expect(
      mapTicketError({ message: 'perfil_inactivo' }),
    ).toContain('no está activa');
  });

  it('detecta el token dentro de details o hint', () => {
    expect(
      mapTicketError({
        message: 'Error',
        details: 'raise exception: datos_invalidos',
      }),
    ).toContain('Algunos datos no son válidos');

    expect(
      mapTicketError({
        message: 'Error',
        hint: 'duplicate_request_conflict',
      }),
    ).toContain('datos distintos');
  });

  it('traduce un permiso denegado a sesión o permisos', () => {
    expect(mapTicketError({ code: '42501', message: 'denied' })).toContain(
      'permisos',
    );

    expect(mapTicketError({ status: 401, message: 'unauthorized' })).toContain(
      'sesión',
    );
  });

  it('detecta una migración no aplicada', () => {
    expect(
      mapTicketError({
        code: 'PGRST202',
        message: 'Could not find the function public.crear_ticket',
      }),
    ).toContain('migraciones');

    expect(
      mapTicketError({
        code: '42P01',
        message: 'relation "public.tickets" does not exist',
      }),
    ).toContain('migraciones');
  });

  it('detecta un fallo de conexión', () => {
    expect(
      mapTicketError({ status: 0, message: 'Failed to fetch' }),
    ).toContain('conexión');

    expect(mapTicketError({ message: 'network error' })).toContain('conexión');
  });

  it('no expone detalles internos ante errores desconocidos', () => {
    const message = mapTicketError({
      message: 'syntax error at or near "secret"',
    });

    expect(message).toBe(
      'No se pudo completar la operación con tickets. Inténtalo de nuevo.',
    );
    expect(message).not.toContain('syntax');
  });

  it('tolera valores que no son objetos', () => {
    expect(mapTicketError(null)).toContain('No se pudo completar');
    expect(mapTicketError('boom')).toContain('No se pudo completar');
  });
});
