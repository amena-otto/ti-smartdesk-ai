import { describe, expect, it } from 'vitest';
import { ambientesDelPiso, pisosDelPabellon } from './catalog-dependencies';
import type { Ambiente, Piso } from './public-report-service';

const pisos: Piso[] = [
  { id: 'piso-a-1', nombre: 'Piso 1', pabellon_id: 'pabellon-a' },
  { id: 'piso-b-1', nombre: 'Piso 1', pabellon_id: 'pabellon-b' },
  { id: 'piso-a-2', nombre: 'Piso 2', pabellon_id: 'pabellon-a' },
];

describe('dependencias de catálogos', () => {
  it('filtra pisos por el identificador real del pabellón', () => {
    expect(pisosDelPabellon(pisos, 'pabellon-a').map((piso) => piso.id)).toEqual([
      'piso-a-1',
      'piso-a-2',
    ]);
  });

  it('no muestra pisos si todavía no hay pabellón seleccionado', () => {
    expect(pisosDelPabellon(pisos, '')).toEqual([]);
  });

  it('filtra ambientes por el identificador real del piso', () => {
    const ambientes: Ambiente[] = [
      { id: 'ambiente-a', nombre: 'Aula A', piso_id: 'piso-a-1' },
      { id: 'ambiente-b', nombre: 'Aula B', piso_id: 'piso-b-1' },
    ];

    expect(ambientesDelPiso(ambientes, 'piso-a-1')).toEqual([ambientes[0]]);
    expect(ambientesDelPiso(ambientes, '')).toEqual([]);
  });
});
