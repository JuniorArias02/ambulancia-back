import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import { fusionarDefinidos } from '../../../../common/utils/objetos.js';
import type {
  Desenlace,
  EstadoHistoria,
  RolVictima,
  Sexo,
  TipoDocumento,
  TipoEvento,
  Triage,
} from '../catalogos_clinicos.js';

/** Lo que llena la tripulación. Todo es opcional mientras es borrador: en trauma grave primero se atiende. */
export interface DatosHistoria {
  // Paciente (en trauma muchas veces es NN)
  pacienteIdentificado: boolean;
  nombres: string | null;
  apellidos: string | null;
  tipoDocumento: TipoDocumento | null;
  numeroDocumento: string | null;
  sexo: Sexo | null;
  edadAproximada: number | null;
  fechaNacimiento: Date | null;
  aseguradoraEps: string | null;
  acompananteNombre: string | null;
  acompananteTelefono: string | null;
  // Evento
  horaEvento: Date | null;
  tipoEvento: TipoEvento | null;
  mecanismoLesion: string | null;
  rolVictima: RolVictima | null;
  elementosProteccion: string | null;
  placaVehiculo: string | null;
  polizaSoat: string | null;
  // Valoración primaria XABCDE
  xHemorragiaMasiva: string | null;
  aViaAerea: string | null;
  bRespiracion: string | null;
  cCirculacion: string | null;
  dNeurologico: string | null;
  eExposicion: string | null;
  triage: Triage | null;
  // Antecedentes (AMPLE corto)
  alergias: string | null;
  medicamentosHabituales: string | null;
  antecedentes: string | null;
  impresionDiagnostica: string | null;
  observaciones: string | null;
  // Desenlace y entrega
  desenlace: Desenlace | null;
  motivoRechazo: string | null;
  institucionDestinoId: string | null;
  condicionEntrega: string | null;
  receptorNombre: string | null;
  receptorCargo: string | null;
  entregadoEn: Date | null;
}

export type DatosEditablesHistoria = Partial<DatosHistoria>;

type CampoTexto = {
  [K in keyof DatosHistoria]: DatosHistoria[K] extends string | null
    ? K
    : never;
}[keyof DatosHistoria];

/** Textos libres: se recortan y el texto vacío queda en null. */
const CAMPOS_TEXTO_LIBRE = [
  'nombres',
  'apellidos',
  'numeroDocumento',
  'aseguradoraEps',
  'acompananteNombre',
  'acompananteTelefono',
  'mecanismoLesion',
  'elementosProteccion',
  'placaVehiculo',
  'polizaSoat',
  'xHemorragiaMasiva',
  'aViaAerea',
  'bRespiracion',
  'cCirculacion',
  'dNeurologico',
  'eExposicion',
  'alergias',
  'medicamentosHabituales',
  'antecedentes',
  'impresionDiagnostica',
  'observaciones',
  'motivoRechazo',
  'condicionEntrega',
  'receptorNombre',
  'receptorCargo',
] as const satisfies readonly CampoTexto[];

export const DATOS_HISTORIA_VACIOS: DatosHistoria = {
  pacienteIdentificado: false,
  nombres: null,
  apellidos: null,
  tipoDocumento: null,
  numeroDocumento: null,
  sexo: null,
  edadAproximada: null,
  fechaNacimiento: null,
  aseguradoraEps: null,
  acompananteNombre: null,
  acompananteTelefono: null,
  horaEvento: null,
  tipoEvento: null,
  mecanismoLesion: null,
  rolVictima: null,
  elementosProteccion: null,
  placaVehiculo: null,
  polizaSoat: null,
  xHemorragiaMasiva: null,
  aViaAerea: null,
  bRespiracion: null,
  cCirculacion: null,
  dNeurologico: null,
  eExposicion: null,
  triage: null,
  alergias: null,
  medicamentosHabituales: null,
  antecedentes: null,
  impresionDiagnostica: null,
  observaciones: null,
  desenlace: null,
  motivoRechazo: null,
  institucionDestinoId: null,
  condicionEntrega: null,
  receptorNombre: null,
  receptorCargo: null,
  entregadoEn: null,
};

export interface PropiedadesHistoriaClinica {
  id: string;
  numeroHistoria: string;
  emergenciaId: string;
  asignacionId: string | null;
  datos: DatosHistoria;
  estado: EstadoHistoria;
  creadaPorId: string;
  cerradaPorId: string | null;
  hashCierre: string | null;
  abiertaEn: Date;
  cerradaEn: Date | null;
  sincronizadaEn: Date | null;
  /** Solo lectura, para mostrar. */
  numeroEmergencia: string | null;
  creadaPorNombre: string | null;
  cerradaPorNombre: string | null;
  institucionDestinoNombre: string | null;
}

/** Lo que se necesita saber de los registros (signos, lesiones…) para validar el cierre. */
export interface ResumenRegistros {
  signosVitales: number;
}

/**
 * Historia clínica prehospitalaria: un paciente atendido en una emergencia.
 * Se llena como borrador; al cerrarla queda sellada con una huella del
 * contenido y ya no se edita: solo se anula.
 */
export class HistoriaClinica {
  private constructor(
    private readonly propiedades: PropiedadesHistoriaClinica,
  ) {}

  static abrir(datos: {
    id: string;
    numeroHistoria: string;
    emergenciaId: string;
    asignacionId: string;
    creadaPorId: string;
    abiertaEn: Date;
    sincronizadaEn: Date;
    datosIniciales?: DatosEditablesHistoria;
  }): HistoriaClinica {
    return new HistoriaClinica({
      id: datos.id,
      numeroHistoria: datos.numeroHistoria,
      emergenciaId: datos.emergenciaId,
      asignacionId: datos.asignacionId,
      datos: HistoriaClinica.normalizar(
        fusionarDefinidos(DATOS_HISTORIA_VACIOS, datos.datosIniciales ?? {}),
      ),
      estado: 'borrador',
      creadaPorId: datos.creadaPorId,
      cerradaPorId: null,
      hashCierre: null,
      abiertaEn: datos.abiertaEn,
      cerradaEn: null,
      sincronizadaEn: datos.sincronizadaEn,
      numeroEmergencia: null,
      creadaPorNombre: null,
      cerradaPorNombre: null,
      institucionDestinoNombre: null,
    });
  }

  static reconstruir(propiedades: PropiedadesHistoriaClinica): HistoriaClinica {
    return new HistoriaClinica({
      ...propiedades,
      datos: { ...propiedades.datos },
    });
  }

  static formatearNumero(dia: string, consecutivo: number): string {
    return `HC-${dia}-${String(consecutivo).padStart(4, '0')}`;
  }

  private static normalizar(datos: DatosHistoria): DatosHistoria {
    const resultado = { ...datos };
    for (const campo of CAMPOS_TEXTO_LIBRE) {
      const valor = resultado[campo];
      if (typeof valor === 'string') resultado[campo] = valor.trim() || null;
    }
    // Documento y placa sin espacios ni guiones, en mayúsculas: así se buscan igual.
    if (resultado.numeroDocumento) {
      resultado.numeroDocumento = resultado.numeroDocumento
        .replace(/[\s.-]/g, '')
        .toUpperCase();
    }
    if (resultado.placaVehiculo) {
      resultado.placaVehiculo = resultado.placaVehiculo
        .replace(/[\s-]/g, '')
        .toUpperCase();
    }
    return resultado;
  }

  get id(): string {
    return this.propiedades.id;
  }
  get numeroHistoria(): string {
    return this.propiedades.numeroHistoria;
  }
  get emergenciaId(): string {
    return this.propiedades.emergenciaId;
  }
  get asignacionId(): string | null {
    return this.propiedades.asignacionId;
  }
  get datos(): Readonly<DatosHistoria> {
    return this.propiedades.datos;
  }
  get estado(): EstadoHistoria {
    return this.propiedades.estado;
  }
  get creadaPorId(): string {
    return this.propiedades.creadaPorId;
  }
  get cerradaPorId(): string | null {
    return this.propiedades.cerradaPorId;
  }
  get hashCierre(): string | null {
    return this.propiedades.hashCierre;
  }
  get abiertaEn(): Date {
    return this.propiedades.abiertaEn;
  }
  get cerradaEn(): Date | null {
    return this.propiedades.cerradaEn;
  }
  get sincronizadaEn(): Date | null {
    return this.propiedades.sincronizadaEn;
  }
  get numeroEmergencia(): string | null {
    return this.propiedades.numeroEmergencia;
  }
  get creadaPorNombre(): string | null {
    return this.propiedades.creadaPorNombre;
  }
  get cerradaPorNombre(): string | null {
    return this.propiedades.cerradaPorNombre;
  }
  get institucionDestinoNombre(): string | null {
    return this.propiedades.institucionDestinoNombre;
  }

  esBorrador(): boolean {
    return this.propiedades.estado === 'borrador';
  }

  /** `undefined` deja el valor igual; `null` lo borra. */
  actualizar(cambios: DatosEditablesHistoria): void {
    this.exigirBorrador();
    this.propiedades.datos = HistoriaClinica.normalizar(
      fusionarDefinidos(this.propiedades.datos, cambios),
    );
  }

  /** Lo que falta para poder cerrar (lista vacía = se puede cerrar). */
  faltantesParaCerrar(registros: ResumenRegistros): string[] {
    const d = this.propiedades.datos;
    const faltantes: string[] = [];
    if (!d.triage) faltantes.push('triage');
    if (!d.desenlace) faltantes.push('desenlace');
    if (d.pacienteIdentificado && !d.nombres && !d.numeroDocumento) {
      faltantes.push('nombres o número de documento del paciente identificado');
    }
    if (d.desenlace === 'rechazo_traslado' && !d.motivoRechazo) {
      faltantes.push('motivo del rechazo del traslado');
    }
    if (d.desenlace === 'trasladado') {
      if (!d.institucionDestinoId) faltantes.push('institución de destino');
      if (!d.receptorNombre)
        faltantes.push('nombre de quien recibe al paciente');
    }
    if (d.desenlace !== 'fallecido_en_sitio' && registros.signosVitales === 0) {
      faltantes.push('al menos una toma de signos vitales');
    }
    return faltantes;
  }

  /** `hash` es la huella del contenido al momento de cerrar (la calcula la aplicación). */
  cerrar(datos: {
    cerradaPorId: string;
    fecha: Date;
    hash: string;
    registros: ResumenRegistros;
  }): void {
    this.exigirBorrador();
    const faltantes = this.faltantesParaCerrar(datos.registros);
    if (faltantes.length > 0) {
      throw new ReglaNegocioError(
        `Para cerrar la historia falta: ${faltantes.join(', ')}`,
      );
    }
    if (
      this.propiedades.datos.desenlace === 'trasladado' &&
      !this.propiedades.datos.entregadoEn
    ) {
      this.propiedades.datos.entregadoEn = datos.fecha;
    }
    this.propiedades.estado = 'cerrada';
    this.propiedades.cerradaPorId = datos.cerradaPorId;
    this.propiedades.cerradaEn = datos.fecha;
    this.propiedades.hashCierre = datos.hash;
  }

  /** Corrige un error sin borrar: la historia queda como anulada, con su contenido intacto. */
  anular(): void {
    if (this.propiedades.estado === 'anulada') {
      throw new ReglaNegocioError('La historia clínica ya está anulada');
    }
    this.propiedades.estado = 'anulada';
  }

  exigirBorrador(): void {
    if (!this.esBorrador()) {
      throw new ReglaNegocioError(
        `La historia clínica está ${this.propiedades.estado} y ya no se puede modificar`,
      );
    }
  }
}
