/** Reglas compartidas entre los DTO de ambulancias. */
export const PATRON_CODIGO_AMBULANCIA = /^[A-Za-z0-9-]{2,30}$/;

/** Placa colombiana de vehículo: 3 letras y 3 números, con espacio o guion opcional. */
export const PATRON_PLACA = /^[A-Za-z]{3}[\s-]?\d{3}$/;
