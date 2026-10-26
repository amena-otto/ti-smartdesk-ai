import { describe, expect, it } from 'vitest';
import {
  getDisplayName,
  getRoleLabel,
  parseProfile,
} from './profile';

const validRow = {
  id: '11111111-1111-4111-8111-111111111111',
  nombres: '  Ana  ',
  apellidos: '  Pérez  ',
  rol: 'tecnico',
  activo: true,
  created_at: '2026-10-26T12:00:00.000Z',
  updated_at: '2026-10-26T12:00:00.000Z',
};

describe('parseProfile', () => {
  it('convierte una fila válida y recorta espacios', () => {
    const profile = parseProfile(validRow);

    expect(profile).toEqual({
      id: validRow.id,
      nombres: 'Ana',
      apellidos: 'Pérez',
      rol: 'tecnico',
      activo: true,
      createdAt: validRow.created_at,
      updatedAt: validRow.updated_at,
    });
  });

  it('rechaza roles no permitidos', () => {
    expect(() =>
      parseProfile({ ...validRow, rol: 'superadmin' }),
    ).toThrow('rol');
  });

  it('rechaza un perfil sin nombres', () => {
    expect(() => parseProfile({ ...validRow, nombres: '   ' })).toThrow(
      'nombres',
    );
  });

  it('rechaza un perfil sin estado booleano', () => {
    expect(() => parseProfile({ ...validRow, activo: 'true' })).toThrow(
      'estado',
    );
  });

  it('rechaza datos que no son un objeto', () => {
    expect(() => parseProfile(null)).toThrow('válido');
  });
});

describe('etiquetas de perfil', () => {
  it('compone el nombre completo', () => {
    expect(
      getDisplayName({
        id: '1',
        nombres: 'Ana',
        apellidos: 'Pérez',
        rol: 'tecnico',
        activo: true,
        createdAt: '',
        updatedAt: '',
      }),
    ).toBe('Ana Pérez');
  });

  it('traduce los roles conocidos', () => {
    expect(getRoleLabel('admin')).toBe('Administrador');
    expect(getRoleLabel('tecnico')).toBe('Técnico');
  });
});
