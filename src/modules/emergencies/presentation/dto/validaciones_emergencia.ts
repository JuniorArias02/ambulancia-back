/** Reglas compartidas entre los DTO de emergencias. */
export const PATRON_TELEFONO_INFORMANTE = /^\+?[0-9\s-]{7,20}$/;

export const LONGITUD_DESCRIPCION = { minima: 5, maxima: 5000 } as const;

export const MAXIMO_VICTIMAS = 500;
