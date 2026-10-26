export const PROFILE_ROLES = ['admin', 'tecnico'] as const;

export type ProfileRole = (typeof PROFILE_ROLES)[number];

export type Profile = {
  id: string;
  nombres: string;
  apellidos: string;
  rol: ProfileRole;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

export function isProfileRole(value: unknown): value is ProfileRole {
  return value === 'admin' || value === 'tecnico';
}

/**
 * Convierte una fila de public.profiles en un perfil de dominio.
 * Rechaza datos incompletos o roles desconocidos en lugar de asumir privilegios.
 */
export function parseProfile(value: unknown): Profile {
  if (typeof value !== 'object' || value === null) {
    throw new Error('El perfil recibido no es válido.');
  }

  const row = value as Record<string, unknown>;

  if (typeof row.id !== 'string' || row.id.length === 0) {
    throw new Error('El perfil no tiene un identificador válido.');
  }

  if (typeof row.nombres !== 'string' || row.nombres.trim().length === 0) {
    throw new Error('El perfil no tiene nombres válidos.');
  }

  if (typeof row.apellidos !== 'string' || row.apellidos.trim().length === 0) {
    throw new Error('El perfil no tiene apellidos válidos.');
  }

  if (!isProfileRole(row.rol)) {
    throw new Error('El perfil tiene un rol no permitido.');
  }

  if (typeof row.activo !== 'boolean') {
    throw new Error('El perfil no tiene un estado válido.');
  }

  if (typeof row.created_at !== 'string' || typeof row.updated_at !== 'string') {
    throw new Error('El perfil no tiene fechas válidas.');
  }

  return {
    id: row.id,
    nombres: row.nombres.trim(),
    apellidos: row.apellidos.trim(),
    rol: row.rol,
    activo: row.activo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getDisplayName(profile: Profile): string {
  return `${profile.nombres} ${profile.apellidos}`.trim();
}

export function getRoleLabel(role: ProfileRole): string {
  return role === 'admin' ? 'Administrador' : 'Técnico';
}
