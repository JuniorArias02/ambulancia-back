import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import { MODALIDADES_SERVICIO } from '../../../emergencies/domain/entities/emergencia.entity.js';
import {
  DESENLACES,
  ESTADOS_HISTORIA,
  type EstadoHistoria,
  REGIMENES_AFILIACION,
  SEXOS,
  TIPOS_DOCUMENTO,
  TIPOS_EVENTO,
  TRIAGES,
} from '../../domain/catalogos_clinicos.js';
import type { FichaPaciente, PacienteResumen } from '../../domain/pacientes.js';
import type { IndicadoresClinicos } from '../../domain/indicadores_clinicos.js';
import type {
  EventoTrazabilidad,
  IngresoServicio,
  ResumenHistoriaConsulta,
  TipoAccionHistoria,
} from '../../domain/consulta_clinica.js';

class PersonaConsultaDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  nombreCompleto: string | null;
}

class PacienteConsultaDto {
  @ApiProperty({ description: 'false = NN (no identificado)' })
  identificado: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) nombres: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  apellidos: string | null;
  @ApiPropertyOptional({ enum: TIPOS_DOCUMENTO, nullable: true })
  tipoDocumento: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  numeroDocumento: string | null;
  @ApiPropertyOptional({ enum: SEXOS, nullable: true }) sexo: string | null;
  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  fechaNacimiento: Date | null;
  @ApiPropertyOptional({ type: Number, nullable: true })
  edadAproximada: number | null;
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description:
      'Años a la fecha de la atención (desde la fecha de nacimiento; si no hay, la edad aproximada)',
  })
  edadAnios: number | null;
}

class IngresoReferenciaDto {
  @ApiProperty({ format: 'uuid' }) emergenciaId: string;
  @ApiProperty({ example: 'EMG-20261114-0003' }) numeroEmergencia: string;
  @ApiProperty({ enum: MODALIDADES_SERVICIO }) modalidad: string;
}

class AmbulanciaReferenciaDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'AMB-02' }) codigo: string;
  @ApiProperty({ example: 'ABC123' }) placa: string;
}

class InstitucionReferenciaDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() nombre: string;
}

class TotalesHistoriaDto {
  @ApiProperty() signosVitales: number;
  @ApiProperty() lesiones: number;
  @ApiProperty() intervenciones: number;
  @ApiProperty() valoracionesDownton: number;
}

export class HistoriaConsultaResumenDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'HC-20261114-0001' }) numeroHistoria: string;
  @ApiProperty({ enum: ESTADOS_HISTORIA }) estado: EstadoHistoria;
  @ApiProperty({ description: 'Fecha de atención (apertura)' })
  abiertaEn: Date;
  @ApiPropertyOptional({ type: Date, nullable: true }) horaEvento: Date | null;
  @ApiPropertyOptional({ type: Date, nullable: true }) cerradaEn: Date | null;
  @ApiProperty({ type: PacienteConsultaDto }) paciente: PacienteConsultaDto;
  @ApiPropertyOptional({ enum: TRIAGES, nullable: true }) triage: string | null;
  @ApiPropertyOptional({ enum: DESENLACES, nullable: true })
  desenlace: string | null;
  @ApiPropertyOptional({ enum: TIPOS_EVENTO, nullable: true })
  tipoEvento: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  impresionDiagnostica: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  aseguradoraEps: string | null;
  @ApiPropertyOptional({ enum: REGIMENES_AFILIACION, nullable: true })
  regimenAfiliacion: string | null;
  @ApiProperty({ type: IngresoReferenciaDto }) ingreso: IngresoReferenciaDto;
  @ApiPropertyOptional({ type: AmbulanciaReferenciaDto, nullable: true })
  ambulancia: AmbulanciaReferenciaDto | null;
  @ApiPropertyOptional({ type: InstitucionReferenciaDto, nullable: true })
  institucionDestino: InstitucionReferenciaDto | null;
  @ApiProperty({ type: PersonaConsultaDto }) creadaPor: PersonaConsultaDto;
  @ApiPropertyOptional({ type: PersonaConsultaDto, nullable: true })
  cerradaPor: PersonaConsultaDto | null;
  @ApiProperty({
    description: 'Cerrada con la firma registrada del profesional',
  })
  firmada: boolean;
  @ApiProperty({ description: 'Alguna valoración Downton dio riesgo alto' })
  riesgoCaidaAlto: boolean;
  @ApiProperty({ type: TotalesHistoriaDto }) totales: TotalesHistoriaDto;

  static desde(h: ResumenHistoriaConsulta): HistoriaConsultaResumenDto {
    return {
      ...h,
      paciente: { ...h.paciente },
      totales: { ...h.totales },
    };
  }
}

export class PaginaHistoriasConsultaDto {
  @ApiProperty({ type: [HistoriaConsultaResumenDto] })
  datos: HistoriaConsultaResumenDto[];
  @ApiProperty() total: number;
  @ApiProperty() pagina: number;
  @ApiProperty() limite: number;

  static desde(
    r: ResultadoPaginado<ResumenHistoriaConsulta>,
  ): PaginaHistoriasConsultaDto {
    return {
      ...r,
      datos: r.datos.map((h) => HistoriaConsultaResumenDto.desde(h)),
    };
  }
}

// --- Ingreso -----------------------------------------------------------------

class IngresoRelacionadoDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() numeroEmergencia: string;
}

class DuplicadaDto extends IngresoRelacionadoDto {
  @ApiProperty() recibidaEn: Date;
}

class EmergenciaIngresoDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'EMG-20261114-0003' }) numeroEmergencia: string;
  @ApiProperty({
    example: 'linea_123',
    description: 'linea_123, telefono, radio, app',
  })
  fuente: string;
  @ApiProperty({
    enum: MODALIDADES_SERVICIO,
    description: 'Modalidad del servicio',
  })
  modalidad: string;
  @ApiProperty({
    example: 'cerrada',
    description: 'recibida, despachada, en_atencion, cerrada, cancelada',
  })
  estado: string;
  @ApiProperty() descripcion: string;
  @ApiPropertyOptional({ type: String, nullable: true }) tipoIncidente:
    string | null;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'roja, amarilla, verde',
  })
  prioridad: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) direccion:
    string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) referenciaLugar:
    string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) latitud: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) longitud:
    number | null;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'gps o manual (reportes desde la app)',
  })
  origenUbicacion: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) numeroVictimas:
    number | null;
  @ApiPropertyOptional({ type: String, nullable: true }) informanteNombre:
    string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) informanteTelefono:
    string | null;
  @ApiProperty({ description: 'La reportó un ciudadano desde la app' })
  reportadaDesdeApp: boolean;
  @ApiProperty() recibidaEn: Date;
  @ApiPropertyOptional({ type: Date, nullable: true }) cerradaEn: Date | null;
  @ApiPropertyOptional({ type: PersonaConsultaDto, nullable: true })
  recibidaPor: PersonaConsultaDto | null;
  @ApiPropertyOptional({
    type: IngresoRelacionadoDto,
    nullable: true,
    description: 'Si esta llamada es duplicada, la emergencia original',
  })
  emergenciaPrincipal: IngresoRelacionadoDto | null;
  @ApiProperty({
    type: [DuplicadaDto],
    description: 'Llamadas duplicadas unidas a esta',
  })
  duplicadas: DuplicadaDto[];
}

class TripulanteDto {
  @ApiProperty({ format: 'uuid' }) usuarioId: string;
  @ApiProperty() nombreCompleto: string;
  @ApiProperty({
    example: 'paramedico',
    description: 'conductor, paramedico, medico',
  })
  funcion: string;
}

class EventoServicioDto {
  @ApiPropertyOptional({ type: String, nullable: true }) estadoAnterior:
    string | null;
  @ApiProperty({
    example: 'en_escena',
    description:
      'asignada, en_camino, en_escena, atendiendo, trasladando, finalizada, cancelada',
  })
  estadoNuevo: string;
  @ApiProperty() ocurridoEn: Date;
  @ApiPropertyOptional({ type: PersonaConsultaDto, nullable: true })
  usuario: PersonaConsultaDto | null;
  @ApiPropertyOptional({ type: String, nullable: true }) rolResponsable:
    string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) latitud: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) longitud:
    number | null;
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Distancia a la escena al marcar la llegada',
  })
  distanciaEscenaMetros: number | null;
  @ApiProperty({
    description: 'Se marcó lejos de la escena (el conductor lo justificó)',
  })
  fueraDeRadio: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) observacion:
    string | null;
}

class TiemposServicioDto {
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Recepción → asignación (segundos)',
  })
  despachoSegundos: number | null;
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Asignación → salida',
  })
  alistamientoSegundos: number | null;
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Asignación → llegada a la escena (tiempo de respuesta)',
  })
  respuestaSegundos: number | null;
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Llegada → salida de la escena',
  })
  enEscenaSegundos: number | null;
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Salida de la escena → llegada al destino',
  })
  trasladoSegundos: number | null;
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Asignación → finalización',
  })
  totalSegundos: number | null;
}

class PuntoRecorridoDto {
  @ApiProperty() latitud: number;
  @ApiProperty() longitud: number;
  @ApiPropertyOptional({ type: Number, nullable: true }) velocidad:
    number | null;
  @ApiProperty() registradaEn: Date;
}

class RecorridoDto {
  @ApiProperty({ type: [PuntoRecorridoDto] }) puntos: PuntoRecorridoDto[];
  @ApiProperty({ description: 'Puntos registrados en total' })
  totalPuntos: number;
  @ApiProperty({
    description: 'true: se enviaron como máximo 1500 puntos repartidos',
  })
  muestreado: boolean;
}

class ItemInsumoDto {
  @ApiProperty({ format: 'uuid' }) insumoId: string;
  @ApiProperty() codigo: string;
  @ApiProperty() nombre: string;
  @ApiProperty() unidadMedida: string;
  @ApiProperty() cantidad: number;
  @ApiPropertyOptional({ type: String, nullable: true }) numeroLote:
    string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) numeroSerie:
    string | null;
}

class MovimientoInsumosDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'MOV-20261114-1A2B3C4D' }) codigo: string;
  @ApiProperty({
    example: 'consumo',
    description: 'consumo, devolucion, transferencia…',
  })
  tipo: string;
  @ApiProperty({
    example: 'confirmado',
    description: 'borrador, confirmado, anulado',
  })
  estado: string;
  @ApiProperty() realizadoEn: Date;
  @ApiProperty({ type: PersonaConsultaDto }) registradoPor: PersonaConsultaDto;
  @ApiProperty({ type: [ItemInsumoDto] }) items: ItemInsumoDto[];
}

class AmbulanciaIngresoDto extends AmbulanciaReferenciaDto {
  @ApiProperty({
    example: 'TAB',
    description: 'Tipo de ambulancia (TAB básica, TAM medicalizada)',
  })
  tipo: string;
}

class InstitucionIngresoDto extends InstitucionReferenciaDto {
  @ApiPropertyOptional({ type: String, nullable: true }) direccion:
    string | null;
}

class AsignacionIngresoDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'finalizada' }) estado: string;
  @ApiProperty({ type: AmbulanciaIngresoDto }) ambulancia: AmbulanciaIngresoDto;
  @ApiProperty({ type: [TripulanteDto] }) tripulacion: TripulanteDto[];
  @ApiPropertyOptional({ type: PersonaConsultaDto, nullable: true })
  asignadaPor: PersonaConsultaDto | null;
  @ApiProperty() asignadaEn: Date;
  @ApiPropertyOptional({ type: Date, nullable: true }) salidaEn: Date | null;
  @ApiPropertyOptional({ type: Date, nullable: true })
  llegadaEscenaEn: Date | null;
  @ApiPropertyOptional({ type: Date, nullable: true })
  atencionInicioEn: Date | null;
  @ApiPropertyOptional({ type: Date, nullable: true })
  salidaEscenaEn: Date | null;
  @ApiPropertyOptional({ type: Date, nullable: true })
  llegadaDestinoEn: Date | null;
  @ApiPropertyOptional({ type: Date, nullable: true })
  finalizadaEn: Date | null;
  @ApiPropertyOptional({ type: String, nullable: true }) motivoCancelacion:
    string | null;
  @ApiPropertyOptional({ type: InstitucionIngresoDto, nullable: true })
  institucionDestino: InstitucionIngresoDto | null;
  @ApiProperty({ type: TiemposServicioDto }) tiempos: TiemposServicioDto;
  @ApiProperty({ type: [EventoServicioDto] }) eventos: EventoServicioDto[];
  @ApiProperty({ type: RecorridoDto }) recorrido: RecorridoDto;
  @ApiProperty({ type: [MovimientoInsumosDto] })
  insumos: MovimientoInsumosDto[];
}

export class IngresoServicioDto {
  @ApiProperty({ type: EmergenciaIngresoDto }) emergencia: EmergenciaIngresoDto;
  @ApiProperty({ type: [AsignacionIngresoDto] })
  asignaciones: AsignacionIngresoDto[];
  @ApiProperty({
    type: [HistoriaConsultaResumenDto],
    description:
      'Todas las historias (pacientes) del ingreso, incluidas las anuladas',
  })
  historias: HistoriaConsultaResumenDto[];

  static desde(i: IngresoServicio): IngresoServicioDto {
    return {
      emergencia: { ...i.emergencia },
      asignaciones: i.asignaciones.map((a) => ({ ...a })),
      historias: i.historias.map((h) => HistoriaConsultaResumenDto.desde(h)),
    };
  }
}

// --- Trazabilidad ------------------------------------------------------------

class UsuarioTrazabilidadDto extends PersonaConsultaDto {
  @ApiPropertyOptional({ type: String, nullable: true, example: 'paramedico' })
  rol: string | null;
}

class EventoTrazabilidadDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'actualizar' }) accion: string;
  @ApiProperty({ example: 'Actualizó datos de la historia' })
  descripcion: string;
  @ApiProperty({
    enum: ['creacion', 'modificacion', 'firma', 'anulacion', 'consulta'],
  })
  tipo: TipoAccionHistoria;
  @ApiProperty() ocurridoEn: Date;
  @ApiPropertyOptional({ type: UsuarioTrazabilidadDto, nullable: true })
  usuario: UsuarioTrazabilidadDto | null;
  @ApiPropertyOptional({ type: String, nullable: true }) direccionIp:
    string | null;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { campos: ['triage', 'desenlace'] },
    description:
      'Solo claves sin valores clínicos: campos, registroId, numeroHistoria, asignacionId, hashCierre, metodoFirma, versionDeclaracion, firmaCierreId, firmaId, motivo',
  })
  detalle: Record<string, unknown>;
}

export class PaginaTrazabilidadDto {
  @ApiProperty({ type: [EventoTrazabilidadDto] })
  datos: EventoTrazabilidadDto[];
  @ApiProperty() total: number;
  @ApiProperty() pagina: number;
  @ApiProperty() limite: number;

  static desde(
    r: ResultadoPaginado<EventoTrazabilidad>,
  ): PaginaTrazabilidadDto {
    return { ...r, datos: r.datos.map((e) => ({ ...e })) };
  }
}

// --- Pacientes ---------------------------------------------------------------

export class PacienteResumenDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'CC' }) tipoDocumento: string;
  @ApiProperty({ example: '1090123456' }) numeroDocumento: string;
  @ApiPropertyOptional({ type: String, nullable: true }) nombres: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  apellidos: string | null;
  @ApiPropertyOptional({ enum: SEXOS, nullable: true }) sexo: string | null;
  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  fechaNacimiento: Date | null;
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Edad a hoy',
  })
  edadAnios: number | null;
  @ApiProperty({ description: 'Historias enlazadas, incluidas las anuladas' })
  totalAtenciones: number;
  @ApiPropertyOptional({ type: Date, nullable: true })
  ultimaAtencion: Date | null;
  @ApiPropertyOptional({ type: String, nullable: true }) ultimaEps:
    string | null;
  @ApiPropertyOptional({ enum: REGIMENES_AFILIACION, nullable: true })
  ultimoRegimen: string | null;
}

export class PaginaPacientesDto {
  @ApiProperty({ type: [PacienteResumenDto] }) datos: PacienteResumenDto[];
  @ApiProperty() total: number;
  @ApiProperty() pagina: number;
  @ApiProperty() limite: number;

  static desde(r: ResultadoPaginado<PacienteResumen>): PaginaPacientesDto {
    return { ...r, datos: r.datos.map((p) => ({ ...p })) };
  }
}

class DatoReunidoDto {
  @ApiProperty({ example: 'Penicilina' }) valor: string;
  @ApiProperty({ example: 'HC-20261025-0001' }) numeroHistoria: string;
  @ApiProperty({ format: 'uuid' }) historiaId: string;
  @ApiProperty({ description: 'Fecha de la atención de donde sale' })
  fecha: Date;
}

class UltimoRiesgoCaidaDto {
  @ApiProperty() puntajeTotal: number;
  @ApiProperty({ example: 'alto' }) nivelRiesgo: string;
  @ApiProperty() evaluadaEn: Date;
  @ApiProperty() numeroHistoria: string;
}

export class FichaPacienteDto {
  @ApiProperty({ type: PacienteResumenDto }) paciente: PacienteResumenDto;
  @ApiProperty({
    type: [HistoriaConsultaResumenDto],
    description: 'De la más reciente a la más antigua, incluidas las anuladas',
  })
  atenciones: HistoriaConsultaResumenDto[];
  @ApiProperty({
    type: [DatoReunidoDto],
    description: 'Sin repetir, de la más reciente a la más antigua',
  })
  alergias: DatoReunidoDto[];
  @ApiProperty({ type: [DatoReunidoDto] })
  medicamentosHabituales: DatoReunidoDto[];
  @ApiProperty({ type: [DatoReunidoDto] }) antecedentes: DatoReunidoDto[];
  @ApiPropertyOptional({ type: UltimoRiesgoCaidaDto, nullable: true })
  ultimoRiesgoCaida: UltimoRiesgoCaidaDto | null;

  static desde(f: FichaPaciente): FichaPacienteDto {
    return {
      ...f,
      paciente: { ...f.paciente },
      atenciones: f.atenciones.map((h) => HistoriaConsultaResumenDto.desde(h)),
    };
  }
}

// --- Indicadores ---------------------------------------------------------------

class ConteoDto {
  @ApiProperty({
    example: 'rojo',
    description: 'El valor; sin_dato si está vacío',
  })
  clave: string;
  @ApiProperty() total: number;
}

class EstadisticaDto {
  @ApiProperty({ description: 'Servicios con las dos marcas de tiempo' })
  servicios: number;
  @ApiPropertyOptional({ type: Number, nullable: true }) promedioSegundos:
    number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) medianaSegundos:
    number | null;
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'El 90 % de los servicios estuvo en este tiempo o menos',
  })
  p90Segundos: number | null;
}

class TiemposIndicadoresDto {
  @ApiProperty({
    type: EstadisticaDto,
    description: 'Asignación → llegada a la escena',
  })
  respuesta: EstadisticaDto;
  @ApiProperty({
    type: EstadisticaDto,
    description: 'Llegada → salida de la escena',
  })
  enEscena: EstadisticaDto;
  @ApiProperty({
    type: EstadisticaDto,
    description: 'Salida de la escena → llegada al destino',
  })
  traslado: EstadisticaDto;
}

class RangoDto {
  @ApiProperty({ example: '2026-10-17' }) desde: string;
  @ApiProperty({ example: '2026-11-15' }) hasta: string;
}

class DiaDto {
  @ApiProperty({ example: '2026-11-15' }) dia: string;
  @ApiProperty() total: number;
}

class InstitucionTotalDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() nombre: string;
  @ApiProperty() total: number;
}

export class IndicadoresClinicosDto {
  @ApiProperty({ type: RangoDto }) rango: RangoDto;
  @ApiProperty({
    description:
      'Historias abiertas en el rango (todas, incluidas las anuladas)',
  })
  totalHistorias: number;
  @ApiProperty() firmadas: number;
  @ApiProperty() rechazosTraslado: number;
  @ApiProperty() pacientesSinIdentificar: number;
  @ApiProperty() conRiesgoCaidaAlto: number;
  @ApiProperty({ type: [ConteoDto] }) porEstado: ConteoDto[];
  @ApiProperty({ type: [ConteoDto] }) porTriage: ConteoDto[];
  @ApiProperty({ type: [ConteoDto] }) porDesenlace: ConteoDto[];
  @ApiProperty({ type: [ConteoDto] }) porModalidad: ConteoDto[];
  @ApiProperty({ type: [ConteoDto] }) porTipoEvento: ConteoDto[];
  @ApiProperty({
    type: [DiaDto],
    description: 'Todos los días del rango, también los de 0',
  })
  porDia: DiaDto[];
  @ApiProperty({
    type: [InstitucionTotalDto],
    description: 'Las 10 con más pacientes',
  })
  institucionesDestino: InstitucionTotalDto[];
  @ApiProperty({
    type: TiemposIndicadoresDto,
    description: 'De los ingresos recibidos en el rango',
  })
  tiempos: TiemposIndicadoresDto;

  static desde(i: IndicadoresClinicos): IndicadoresClinicosDto {
    return { ...i };
  }
}
