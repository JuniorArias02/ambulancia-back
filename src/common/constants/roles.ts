/**
 * Roles del sistema. Cada usuario tiene un único rol; el seed los sincroniza
 * con la base de datos y la autorización en el backend se valida por rol.
 */
export const Roles = {
  ADMINISTRADOR: 'administrador',
  /** Recibe las alertas de emergencia y despacha las ambulancias. */
  DESPACHADOR: 'despachador',
  PARAMEDICO: 'paramedico',
  CONDUCTOR: 'conductor',
  /** Reporta emergencias desde la app; solo se crea con el registro público. */
  CIUDADANO: 'ciudadano',
} as const;

export type NombreRol = (typeof Roles)[keyof typeof Roles];

export const NOMBRES_ROLES: readonly NombreRol[] = Object.values(Roles);

/**
 * Roles que el administrador puede crear o asignar. El ciudadano queda fuera:
 * solo nace del registro público, con su verificación de identidad.
 */
export const ROLES_INTERNOS: readonly NombreRol[] = [
  Roles.ADMINISTRADOR,
  Roles.DESPACHADOR,
  Roles.PARAMEDICO,
  Roles.CONDUCTOR,
];

export function esRolValido(rol: string): rol is NombreRol {
  return NOMBRES_ROLES.some((valido) => valido === rol);
}
