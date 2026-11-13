import { ConflictoNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import { Prisma } from '../../../../generated/prisma/client.js';

/** DATE sin hora: el proyecto guarda la medianoche UTC del día de calendario. */
export function aFechaBd(fecha: string): Date;
export function aFechaBd(fecha: string | null): Date | null;
export function aFechaBd(fecha: string | null): Date | null {
  return fecha === null ? null : new Date(`${fecha}T00:00:00.000Z`);
}

export function deFechaBd(fecha: Date): string;
export function deFechaBd(fecha: Date | null): string | null;
export function deFechaBd(fecha: Date | null): string | null {
  return fecha === null ? null : fecha.toISOString().slice(0, 10);
}

export function aNumero(valor: Prisma.Decimal): number;
export function aNumero(valor: Prisma.Decimal | null): number | null;
export function aNumero(valor: Prisma.Decimal | null): number | null {
  return valor === null ? null : valor.toNumber();
}

/** Colombia no tiene horario de verano: el día va de 00:00 a 24:00 en UTC-5. */
export function rangoDiasColombia(
  desde?: string,
  hasta?: string,
): Prisma.DateTimeFilter | undefined {
  if (!desde && !hasta) return undefined;
  const filtro: Prisma.DateTimeFilter = {};
  if (desde) filtro.gte = new Date(`${desde}T00:00:00.000-05:00`);
  if (hasta) {
    const fin = new Date(`${hasta}T00:00:00.000-05:00`);
    fin.setUTCDate(fin.getUTCDate() + 1);
    filtro.lt = fin;
  }
  return filtro;
}

export function esDuplicado(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

/** Valor conocido de una columna de texto; si no, la base tiene datos que el código no entiende. */
export function valorConocido<T extends string>(
  permitidos: readonly T[],
  valor: string,
  columna: string,
): T {
  const conocido = permitidos.find((permitido) => permitido === valor);
  if (!conocido) {
    throw new Error(`Valor desconocido en ${columna}: ${valor}`);
  }
  return conocido;
}

export function nombreCompleto(
  usuario: { nombres: string; apellidos: string } | null,
): string | null {
  return usuario ? `${usuario.nombres} ${usuario.apellidos}` : null;
}

/** Nombre visible de una ubicación: la bodega o el código de la ambulancia. */
export const seleccionNombreUbicacion = {
  bodega: { select: { nombre: true } },
  ambulancia: { select: { codigo: true } },
} satisfies Prisma.UbicacionInventarioSelect;

export function nombreUbicacion(registro: {
  bodega: { nombre: string } | null;
  ambulancia: { codigo: string } | null;
}): string | null {
  return registro.bodega?.nombre ?? registro.ambulancia?.codigo ?? null;
}

/**
 * La verificación previa ("¿ya existe el código?") cubre el caso normal; esto
 * cubre a dos solicitudes simultáneas que pasaron la verificación a la vez.
 */
export async function siDuplicado<T>(
  operacion: () => Promise<T>,
  mensaje: string,
): Promise<T> {
  try {
    return await operacion();
  } catch (error) {
    if (esDuplicado(error)) throw new ConflictoNegocioError(mensaje);
    throw error;
  }
}
