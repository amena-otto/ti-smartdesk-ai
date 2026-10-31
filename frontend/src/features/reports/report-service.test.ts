import { describe, expect, it } from 'vitest';
import {
  calcularTasaResolucion,
  initialReportState,
  parseReporteEficiencia,
  reportReducer,
  type EfficiencyReport,
} from './report-service';

const reporte: EfficiencyReport = {
  resumen: {
    recibidos: 8,
    resueltos: 3,
    pendientes: 5,
    reabiertos: 1,
    tiempo_inicio_minutos: 12.5,
    tiempo_resolucion_minutos: 45,
    tasa_resolucion: 37.5,
  },
  evolucion: [
    { periodo: 'diaria', fecha: '2026-10-26', recibidos: 4, resueltos: 2 },
  ],
};

describe('métricas de eficiencia', () => {
  it('calcula la tasa con división decimal y evita división por cero', () => {
    expect(calcularTasaResolucion(8, 3)).toBe(37.5);
    expect(calcularTasaResolucion(3, 1)).toBe(33.33);
    expect(calcularTasaResolucion(2, 1)).toBe(50);
    expect(calcularTasaResolucion(0, 0)).toBe(0);
  });

  it('interpreta el resumen y descarta puntos de evolución inválidos', () => {
    expect(
      parseReporteEficiencia({
        resumen: reporte.resumen,
        evolucion: [
          ...reporte.evolucion,
          { periodo: 'diaria', fecha: 'sin-numeros', recibidos: '4' },
        ],
      }),
    ).toEqual(reporte);
  });

  it('rechaza una respuesta sin resumen válido', () => {
    expect(parseReporteEficiencia(null)).toBeNull();
    expect(
      parseReporteEficiencia({ resumen: null, evolucion: [] }),
    ).toBeNull();
    expect(
      parseReporteEficiencia({ resumen: reporte.resumen, evolucion: null }),
    ).toBeNull();
  });
});

describe('estado de carga del reporte', () => {
  it('limpia el error al iniciar y después de una respuesta exitosa', () => {
    let state = reportReducer(initialReportState, {
      type: 'failure',
      message: 'No se pudo cargar el reporte de eficiencia.',
    });

    expect(state.error).toBe('No se pudo cargar el reporte de eficiencia.');
    expect(state.loading).toBe(false);

    state = reportReducer(state, { type: 'start' });

    expect(state.error).toBeNull();
    expect(state.loading).toBe(true);

    state = reportReducer(state, { type: 'success', data: reporte });

    expect(state.error).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.report).toEqual(reporte);
  });

  it('un fallo seguido de éxito deja el reporte visible y sin error', () => {
    let state = reportReducer(initialReportState, {
      type: 'failure',
      message: 'Fallo temporal.',
    });

    state = reportReducer(state, { type: 'success', data: reporte });

    expect(state.error).toBeNull();
    expect(state.report).toEqual(reporte);
  });
});
