import { describe, expect, it } from 'vitest';
import type { Profile } from './profile';
import {
  formatTicketDate,
  getAccionLabel,
  getEstadoLabel,
  getTicketPermisos,
  hasValidationErrors,
  isCanalManual,
  isTicketEstado,
  validateMotivoReapertura,
  validateNuevoTicket,
  validateSolucion,
  type NuevoTicketInput,
  type Ticket,
} from './ticket';
import { parseTicket, parseTicketHistorialItem } from './ticket-parse';

const baseTicket: Ticket = {
  id: 'ticket-1',
  numeroTicket: 'TS-000001',
  asunto: 'No enciende el equipo',
  descripcion: 'El equipo de laboratorio no enciende al pulsar el botón.',
  categoriaId: 'cat-hardware',
  categoriaNombre: 'Hardware',
  solicitanteNombre: 'Ana Pérez',
  solicitanteTipo: 'docente',
  ubicacion: 'Laboratorio 2',
  canalOrigen: 'manual',
  estado: 'nuevo',
  tecnicoAsignadoId: null,
  tecnicoAsignadoNombre: null,
  solucion: null,
  fechaCreacion: '2026-10-26T12:00:00.000Z',
  fechaInicioAtencion: null,
  fechaResolucion: null,
  fechaCierre: null,
  createdBy: 'profile-1',
};

const tecnico: Pick<Profile, 'id' | 'rol'> = {
  id: 'profile-1',
  rol: 'tecnico',
};

const otroTecnico: Pick<Profile, 'id' | 'rol'> = {
  id: 'profile-2',
  rol: 'tecnico',
};

const admin: Pick<Profile, 'id' | 'rol'> = {
  id: 'profile-admin',
  rol: 'admin',
};

function validInput(): NuevoTicketInput {
  return {
    asunto: 'No enciende el equipo',
    descripcion: 'El equipo no enciende al pulsar el botón de encendido.',
    categoriaId: 'cat-hardware',
    solicitanteNombre: 'Ana Pérez',
    solicitanteTipo: 'docente',
    ubicacion: 'Laboratorio 2',
    canalOrigen: 'manual',
  };
}

describe('parseTicket', () => {
  it('convierte una fila de Supabase en un ticket de dominio', () => {
    const ticket = parseTicket({
      id: 'ticket-1',
      numero_ticket: 'TS-000001',
      asunto: 'No enciende el equipo',
      descripcion: 'El equipo no enciende al pulsar el botón de encendido.',
      categoria_id: 'cat-hardware',
      categoria: { nombre: 'Hardware' },
      solicitante_nombre: 'Ana Pérez',
      solicitante_tipo: 'docente',
      ubicacion: 'Laboratorio 2',
      canal_origen: 'manual',
      estado: 'nuevo',
      tecnico_asignado_id: null,
      tecnico: null,
      solucion: null,
      fecha_creacion: '2026-10-26T12:00:00.000Z',
      fecha_inicio_atencion: null,
      fecha_resolucion: null,
      fecha_cierre: null,
      created_by: 'profile-1',
    });

    expect(ticket.numeroTicket).toBe('TS-000001');
    expect(ticket.categoriaNombre).toBe('Hardware');
    expect(ticket.tecnicoAsignadoNombre).toBeNull();
    expect(ticket.estado).toBe('nuevo');
  });

  it('obtiene el nombre del técnico asignado desde la relación', () => {
    const ticket = parseTicket({
      id: 'ticket-1',
      numero_ticket: 'TS-000001',
      asunto: 'No enciende el equipo',
      descripcion: 'El equipo no enciende al pulsar el botón de encendido.',
      categoria_id: 'cat-hardware',
      categoria: [{ nombre: 'Hardware' }],
      solicitante_nombre: 'Ana Pérez',
      solicitante_tipo: 'docente',
      ubicacion: null,
      canal_origen: 'manual',
      estado: 'en_atencion',
      tecnico_asignado_id: 'profile-1',
      tecnico: { nombres: 'Otto', apellidos: 'Tonsmann' },
      solucion: null,
      fecha_creacion: '2026-10-26T12:00:00.000Z',
      fecha_inicio_atencion: '2026-10-26T12:10:00.000Z',
      fecha_resolucion: null,
      fecha_cierre: null,
      created_by: 'profile-1',
    });

    expect(ticket.tecnicoAsignadoNombre).toBe('Otto Tonsmann');
  });

  it('rechaza un estado no permitido', () => {
    expect(() =>
      parseTicket({
        id: 'ticket-1',
        numero_ticket: 'TS-000001',
        asunto: 'Asunto',
        descripcion: 'Descripción',
        categoria_id: 'cat',
        categoria: null,
        solicitante_nombre: 'Ana',
        solicitante_tipo: 'docente',
        ubicacion: null,
        canal_origen: 'manual',
        estado: 'pendiente',
        tecnico_asignado_id: null,
        tecnico: null,
        solucion: null,
        fecha_creacion: '2026-10-26T12:00:00.000Z',
        fecha_inicio_atencion: null,
        fecha_resolucion: null,
        fecha_cierre: null,
        created_by: null,
      }),
    ).toThrow('estado no permitido');
  });
});

describe('parseTicketHistorialItem', () => {
  it('convierte una fila de historial y su actor', () => {
    const item = parseTicketHistorialItem({
      id: 12,
      ticket_id: 'ticket-1',
      accion: 'resuelto',
      estado_anterior: 'en_atencion',
      estado_nuevo: 'resuelto',
      actor_id: 'profile-1',
      actor: { nombres: 'Otto', apellidos: 'Tonsmann' },
      detalle: 'Se reemplazó la fuente de poder.',
      creado_en: '2026-10-26T13:00:00.000Z',
    });

    expect(item.id).toBe('12');
    expect(item.actorNombre).toBe('Otto Tonsmann');
    expect(item.estadoAnterior).toBe('en_atencion');
    expect(item.detalle).toBe('Se reemplazó la fuente de poder.');
  });

  it('rechaza una acción desconocida', () => {
    expect(() =>
      parseTicketHistorialItem({
        id: 12,
        ticket_id: 'ticket-1',
        accion: 'eliminado',
        estado_anterior: 'nuevo',
        estado_nuevo: 'nuevo',
        actor_id: 'profile-1',
        actor: null,
        detalle: null,
        creado_en: '2026-10-26T13:00:00.000Z',
      }),
    ).toThrow('acción no permitida');
  });
});

describe('getTicketPermisos', () => {
  it('permite tomar un ticket nuevo sin asignar a un técnico', () => {
    const permisos = getTicketPermisos(baseTicket, tecnico);

    expect(permisos.tomar).toBe(false);
    expect(permisos.iniciar).toBe(true);
    expect(permisos.resolver).toBe(false);
  });

  it('permite iniciar cuando el ticket está asignado al técnico actual', () => {
    const permisos = getTicketPermisos(
      { ...baseTicket, tecnicoAsignadoId: tecnico.id },
      tecnico,
    );

    expect(permisos.tomar).toBe(false);
    expect(permisos.iniciar).toBe(true);
  });

  it('no permite tomar un ticket asignado a otro técnico', () => {
    const permisos = getTicketPermisos(
      { ...baseTicket, tecnicoAsignadoId: otroTecnico.id },
      tecnico,
    );

    expect(permisos.tomar).toBe(false);
    expect(permisos.iniciar).toBe(true);
  });

  it('permite resolver solo al técnico asignado en atención', () => {
    const ticket = {
      ...baseTicket,
      estado: 'en_atencion' as const,
      tecnicoAsignadoId: tecnico.id,
      fechaInicioAtencion: '2026-10-26T12:10:00.000Z',
    };

    expect(getTicketPermisos(ticket, tecnico).resolver).toBe(true);
    expect(getTicketPermisos(ticket, otroTecnico).resolver).toBe(true);
  });

  it('permite cerrar y reabrir un ticket resuelto asignado', () => {
    const ticket = {
      ...baseTicket,
      estado: 'resuelto' as const,
      tecnicoAsignadoId: tecnico.id,
      solucion: 'Se reemplazó la fuente.',
      fechaResolucion: '2026-10-26T13:00:00.000Z',
    };

    const permisos = getTicketPermisos(ticket, tecnico);

    expect(permisos.cerrar).toBe(true);
    expect(permisos.reabrir).toBe(true);
  });

  it('permite reabrir un ticket cerrado a cualquier técnico activo', () => {
    const ticket = {
      ...baseTicket,
      estado: 'cerrado' as const,
      tecnicoAsignadoId: otroTecnico.id,
      solucion: 'Se reemplazó la fuente.',
      fechaResolucion: '2026-10-26T13:00:00.000Z',
      fechaCierre: '2026-10-26T14:00:00.000Z',
    };

    expect(getTicketPermisos(ticket, tecnico).reabrir).toBe(true);
  });

  it('permite operar a cualquier administrador activo del equipo', () => {
    const permisos = getTicketPermisos(baseTicket, admin);

    expect(permisos).toEqual({
      tomar: false,
      iniciar: true,
      resolver: false,
      cerrar: false,
      reabrir: false,
    });
  });
});

describe('validaciones de tickets', () => {
  it('acepta un formulario completo', () => {
    const errors = validateNuevoTicket(validInput());

    expect(hasValidationErrors(errors)).toBe(false);
  });

  it('exige asunto, descripción, categoría y nombre', () => {
    const errors = validateNuevoTicket({
      ...validInput(),
      asunto: '  ',
      descripcion: '',
      categoriaId: '',
      solicitanteNombre: ' ',
    });

    expect(errors.asunto).toBeDefined();
    expect(errors.descripcion).toBeDefined();
    expect(errors.categoriaId).toBeDefined();
    expect(errors.solicitanteNombre).toBeDefined();
  });

  it('limita la longitud de la ubicación opcional', () => {
    const errors = validateNuevoTicket({
      ...validInput(),
      ubicacion: 'x'.repeat(201),
    });

    expect(errors.ubicacion).toContain('200');
  });

  it('rechaza canales que no son manuales en el formulario', () => {
    const errors = validateNuevoTicket({
      ...validInput(),
      canalOrigen: 'ia' as NuevoTicketInput['canalOrigen'],
    });

    expect(errors.canalOrigen).toBeDefined();
  });

  it('exige una solución suficientemente descriptiva', () => {
    expect(validateSolucion('ok')).toContain('al menos');
    expect(validateSolucion('Se reinició el servicio de red.')).toBeNull();
  });

  it('limita el motivo de reapertura', () => {
    expect(validateMotivoReapertura('x'.repeat(1001))).toContain('1000');
    expect(validateMotivoReapertura('Reapareció el error.')).toBeNull();
  });
});

describe('etiquetas y utilidades', () => {
  it('traduce estados y acciones', () => {
    expect(getEstadoLabel('en_atencion')).toBe('En atención');
    expect(getAccionLabel('reabierto')).toBe('Ticket reabierto');
  });

  it('valida estados y canales en tiempo de ejecución', () => {
    expect(isTicketEstado('nuevo')).toBe(true);
    expect(isTicketEstado('pendiente')).toBe(false);
    expect(isCanalManual('ia')).toBe(false);
    expect(isCanalManual('correo')).toBe(true);
  });

  it('formatea fechas y tolera valores ausentes', () => {
    expect(formatTicketDate(null)).toBe('—');
    expect(formatTicketDate('no-es-fecha')).toBe('—');
    expect(formatTicketDate('2026-10-26T12:00:00.000Z')).not.toBe('—');
  });
});
