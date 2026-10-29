import type { Ambiente, Piso } from './public-report-service';

/** Devuelve únicamente los pisos pertenecientes al pabellón seleccionado. */
export function pisosDelPabellon(pisos: Piso[], pabellonId: string): Piso[] {
  if (!pabellonId) {
    return [];
  }

  return pisos.filter((piso) => piso.pabellon_id === pabellonId);
}

/** Devuelve únicamente los ambientes pertenecientes al piso seleccionado. */
export function ambientesDelPiso(
  ambientes: Ambiente[],
  pisoId: string,
): Ambiente[] {
  if (!pisoId) {
    return [];
  }

  return ambientes.filter((ambiente) => ambiente.piso_id === pisoId);
}
