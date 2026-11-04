import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  order: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  requireSupabase: () => ({ from: mocks.from }),
}));

import { listarDocentes } from './public-report-service';

describe('catálogo público de docentes', () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.select.mockReset();
    mocks.order.mockReset();
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ order: mocks.order });
  });

  it('solicita solo id y nombre_completo, sin correo_institucional', async () => {
    mocks.order.mockResolvedValue({
      data: [{ id: 'docente-1', nombre_completo: 'Ana Pérez' }],
      error: null,
    });

    const result = await listarDocentes();

    expect(mocks.from).toHaveBeenCalledWith('catalogo_docentes');
    expect(mocks.select).toHaveBeenCalledWith('id, nombre_completo');
    expect(mocks.select).not.toHaveBeenCalledWith(
      expect.stringContaining('correo_institucional'),
    );
    expect(mocks.order).toHaveBeenCalledWith('nombre');
    expect(result).toEqual({
      ok: true,
      data: [{ id: 'docente-1', nombre: 'Ana Pérez' }],
    });
  });
});
