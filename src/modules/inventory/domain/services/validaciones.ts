import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';

/** Máximo que cabe en DECIMAL(12,3). */
export const CANTIDAD_MAXIMA = 999_999_999.999;

/** Margen para relojes de celular un poco adelantados. */
const TOLERANCIA_FUTURO_MS = 5 * 60 * 1000;

const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function textoObligatorio(
  valor: string,
  campo: string,
  maximo: number,
): string {
  const limpio = valor.trim();
  if (!limpio) throw new ReglaNegocioError(`${campo} es obligatorio`);
  if (limpio.length > maximo) {
    throw new ReglaNegocioError(`${campo} admite máximo ${maximo} caracteres`);
  }
  return limpio;
}

/** Texto vacío equivale a no enviarlo. */
export function textoOpcional(
  valor: string | null | undefined,
  campo: string,
  maximo: number,
): string | null {
  if (valor === null || valor === undefined) return null;
  const limpio = valor.trim();
  if (!limpio) return null;
  if (limpio.length > maximo) {
    throw new ReglaNegocioError(`${campo} admite máximo ${maximo} caracteres`);
  }
  return limpio;
}

/** Códigos internos: sin espacios alrededor y en mayúscula. */
export function codigo(valor: string, campo: string, maximo = 50): string {
  return textoObligatorio(valor, campo, maximo).toUpperCase();
}

/** Redondea a 3 decimales, como la columna DECIMAL(12,3). */
export function redondearCantidad(valor: number): number {
  return Math.round(valor * 1000) / 1000;
}

export function cantidadNoNegativa(valor: number, campo: string): number {
  if (!Number.isFinite(valor) || valor < 0 || valor > CANTIDAD_MAXIMA) {
    throw new ReglaNegocioError(
      `${campo} debe estar entre 0 y ${CANTIDAD_MAXIMA}`,
    );
  }
  return redondearCantidad(valor);
}

export function cantidadPositiva(valor: number, campo: string): number {
  const cantidad = cantidadNoNegativa(valor, campo);
  if (cantidad <= 0)
    throw new ReglaNegocioError(`${campo} debe ser mayor que 0`);
  return cantidad;
}

/** "AAAA-MM-DD" que existe en el calendario (rechaza 2026-02-30). */
export function fechaOpcional(
  valor: string | null | undefined,
  campo: string,
): string | null {
  if (valor === null || valor === undefined) return null;
  const fecha = new Date(`${valor}T00:00:00.000Z`);
  if (
    !PATRON_FECHA.test(valor) ||
    Number.isNaN(fecha.getTime()) ||
    fecha.toISOString().slice(0, 10) !== valor
  ) {
    throw new ReglaNegocioError(`${campo} no es una fecha válida (AAAA-MM-DD)`);
  }
  return valor;
}

export function exigirOrden(
  anterior: string | null,
  posterior: string | null,
  mensaje: string,
): void {
  if (anterior && posterior && anterior > posterior) {
    throw new ReglaNegocioError(mensaje);
  }
}

export function noEnElFuturo(fecha: Date, ahora: Date, campo: string): Date {
  if (fecha.getTime() > ahora.getTime() + TOLERANCIA_FUTURO_MS) {
    throw new ReglaNegocioError(`${campo} no puede estar en el futuro`);
  }
  return fecha;
}

export function esUno<T extends string>(
  permitidos: readonly T[],
  valor: string,
): valor is T {
  return permitidos.some((permitido) => permitido === valor);
}
