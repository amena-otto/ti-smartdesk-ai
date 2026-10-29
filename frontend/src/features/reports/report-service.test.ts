import { describe, expect, it } from 'vitest';
import { calcularTasaResolucion } from './report-service';

describe('métricas de eficiencia', () => {
  it('calcula la tasa sobre el equipo completo y evita división por cero', () => {
    expect(calcularTasaResolucion(8, 3)).toBe(37.5);
    expect(calcularTasaResolucion(0, 0)).toBe(0);
  });
});
