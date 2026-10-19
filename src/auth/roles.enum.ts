export type UserRole = 'admin' | 'taller' | 'tecnico' | 'operador' | 'cliente';

export enum Role {
  ADMIN = 'admin',
  TALLER = 'taller',
  TECNICO = 'tecnico',
  OPERADOR = 'operador',
  CLIENTE = 'cliente',
}

export const USER_ROLES: readonly UserRole[] = [
  'admin',
  'taller',
  'tecnico',
  'operador',
  'cliente',
] as const;

export function isValidRole(role: string): role is UserRole {
  return (USER_ROLES as readonly string[]).includes(role);
}
