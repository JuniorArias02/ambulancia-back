import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type {
  RegionCorporal,
  TipoIntervencion,
  TipoLesion,
} from '../catalogos_clinicos.js';

/** Registros que se agregan a una historia (una serie, no un solo valor). Por ahora todos manuales. */
interface RegistroBase {
  id: string;
  historiaClinicaId: string;
}

export interface MedicionesSignoVital {
  presionSistolica: number | null;
  presionDiastolica: number | null;
  frecuenciaCardiaca: number | null;
  frecuenciaRespiratoria: number | null;
  saturacionOxigeno: number | null;
  temperatura: number | null;
  glucometria: number | null;
  glasgowOcular: number | null;
  glasgowVerbal: number | null;
  glasgowMotor: number | null;
  escalaDolor: number | null;
}

export interface SignoVital extends RegistroBase, MedicionesSignoVital {
  medidoEn: Date;
  /** Se calcula con las tres partes; null si falta alguna. */
  glasgowTotal: number | null;
  registradoPorId: string;
  registradoPorNombre: string | null;
}

export interface Lesion extends RegistroBase {
  regionCorporal: RegionCorporal;
  tipoLesion: TipoLesion;
  descripcion: string | null;
}

export interface Intervencion extends RegistroBase {
  tipo: TipoIntervencion;
  nombre: string;
  dosis: string | null;
  via: string | null;
  realizadoEn: Date | null;
  resultado: string | null;
  registradoPorId: string;
  registradoPorNombre: string | null;
}

export function crearSignoVital(datos: {
  id: string;
  historiaClinicaId: string;
  medidoEn: Date;
  mediciones: MedicionesSignoVital;
  registradoPorId: string;
}): SignoVital {
  const m = datos.mediciones;
  if (Object.values(m).every((valor) => valor === null)) {
    throw new ReglaNegocioError('Registre al menos una medición');
  }
  if (
    m.presionSistolica !== null &&
    m.presionDiastolica !== null &&
    m.presionDiastolica >= m.presionSistolica
  ) {
    throw new ReglaNegocioError(
      'La presión diastólica debe ser menor que la sistólica',
    );
  }
  const glasgowTotal =
    m.glasgowOcular !== null &&
    m.glasgowVerbal !== null &&
    m.glasgowMotor !== null
      ? m.glasgowOcular + m.glasgowVerbal + m.glasgowMotor
      : null;
  return {
    id: datos.id,
    historiaClinicaId: datos.historiaClinicaId,
    medidoEn: datos.medidoEn,
    ...m,
    glasgowTotal,
    registradoPorId: datos.registradoPorId,
    registradoPorNombre: null,
  };
}

export function crearLesion(
  datos: Omit<Lesion, 'descripcion'> & { descripcion?: string | null },
): Lesion {
  return { ...datos, descripcion: datos.descripcion?.trim() || null };
}

export function crearIntervencion(
  datos: Omit<
    Intervencion,
    'registradoPorNombre' | 'dosis' | 'via' | 'resultado' | 'realizadoEn'
  > &
    Partial<Pick<Intervencion, 'dosis' | 'via' | 'resultado' | 'realizadoEn'>>,
): Intervencion {
  const nombre = datos.nombre.trim();
  if (!nombre)
    throw new ReglaNegocioError('El nombre de la intervención es obligatorio');
  return {
    id: datos.id,
    historiaClinicaId: datos.historiaClinicaId,
    tipo: datos.tipo,
    nombre,
    dosis: datos.dosis?.trim() || null,
    via: datos.via?.trim() || null,
    realizadoEn: datos.realizadoEn ?? null,
    resultado: datos.resultado?.trim() || null,
    registradoPorId: datos.registradoPorId,
    registradoPorNombre: null,
  };
}
