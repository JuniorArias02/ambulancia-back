import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import { noEnElFuturo, textoOpcional } from '../services/validaciones.js';

export const RANGO_TEMPERATURA = { minimo: -50, maximo: 100 } as const;
export const RANGO_HUMEDAD = { minimo: 0, maximo: 100 } as const;

export interface DatosControlAlmacenamiento {
  ubicacionId: string;
  usuarioId: string;
  temperatura: number | null;
  humedad: number | null;
  /** Cuándo se tomó la lectura; si no se indica, ahora. */
  registradoEn: Date | null;
  observaciones: string | null;
}

export interface ControlAlmacenamiento {
  id: string;
  ubicacionId: string;
  usuarioId: string;
  temperatura: number | null;
  humedad: number | null;
  registradoEn: Date;
  observaciones: string | null;
  creadoEn: Date;
  /** Solo lectura. */
  ubicacionNombre: string | null;
  usuarioNombre: string | null;
}

function lectura(
  valor: number | null,
  rango: { minimo: number; maximo: number },
  campo: string,
): number | null {
  if (valor === null) return null;
  if (!Number.isFinite(valor) || valor < rango.minimo || valor > rango.maximo) {
    throw new ReglaNegocioError(
      `${campo} debe estar entre ${rango.minimo} y ${rango.maximo}`,
    );
  }
  return Math.round(valor * 100) / 100;
}

/** Lectura de temperatura y humedad. Se registra y no se edita. */
export function registrarControlAlmacenamiento(
  datos: DatosControlAlmacenamiento,
  ahora: Date,
): ControlAlmacenamiento {
  const temperatura = lectura(
    datos.temperatura,
    RANGO_TEMPERATURA,
    'La temperatura',
  );
  const humedad = lectura(datos.humedad, RANGO_HUMEDAD, 'La humedad');
  if (temperatura === null && humedad === null) {
    throw new ReglaNegocioError('Registre la temperatura, la humedad o ambas');
  }
  return {
    id: crypto.randomUUID(),
    ubicacionId: datos.ubicacionId,
    usuarioId: datos.usuarioId,
    temperatura,
    humedad,
    registradoEn: noEnElFuturo(
      datos.registradoEn ?? ahora,
      ahora,
      'La fecha de la lectura',
    ),
    observaciones: textoOpcional(
      datos.observaciones,
      'Las observaciones',
      5000,
    ),
    creadoEn: ahora,
    ubicacionNombre: null,
    usuarioNombre: null,
  };
}
