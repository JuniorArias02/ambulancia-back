/** Reglas compartidas entre los DTO de usuarios y autenticación. */
export const POLITICA_CONTRASENA = {
  longitudMinima: 10,
  longitudMaxima: 128,
  patron: /^(?=.*\p{L})(?=.*\d).+$/u,
  mensaje: 'La contraseña debe contener al menos una letra y un número',
} as const;

export const PATRON_TELEFONO = /^\+?[0-9\s-]{7,20}$/;
