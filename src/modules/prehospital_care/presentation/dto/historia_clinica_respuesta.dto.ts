import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  DEAMBULACIONES,
  DESENLACES,
  type Desenlace,
  ESTADOS_HISTORIA,
  ESTADOS_MENTALES,
  type EstadoHistoria,
  NIVELES_RIESGO_CAIDA,
  REGIMENES_AFILIACION,
  REGIONES_CORPORALES,
  ROLES_VICTIMA,
  SEXOS,
  TIPOS_DOCUMENTO,
  TIPOS_EVENTO,
  TIPOS_INTERVENCION,
  TIPOS_LESION,
  TRIAGES,
  type Triage,
} from '../../domain/catalogos_clinicos.js';
import type {
  DatosHistoria,
  HistoriaClinica,
} from '../../domain/entities/historia_clinica.entity.js';
import type {
  Intervencion,
  Lesion,
  SignoVital,
} from '../../domain/entities/registros_clinicos.js';
import { DECLARACION_FIRMA_HISTORIA } from '../../domain/declaracion_firma.js';
import type { DetalleHistoria } from '../../domain/repositories/historias_clinicas.repository.js';
import { ValoracionDowntonRespuestaDto } from './valoracion_downton.dto.js';
import { FirmaHistoriaRespuestaDto } from './firma_historia.dto.js';
import {
  DOCUMENTOS_ADULTO,
  MOTIVOS_SIN_FIRMA,
  PARENTESCOS,
  PROPOSITOS_FIRMA,
  PROPOSITOS_POR_ROL,
  resumirFirma,
  ROLES_FIRMANTE,
  TEXTOS_FIRMA,
} from '../../domain/entities/firma_historia.js';
import { POLITICAS_FIRMA } from '../../domain/politicas_firma.js';
import {
  MODALIDADES_SERVICIO,
  type ModalidadServicio,
} from '../../../emergencies/domain/entities/emergencia.entity.js';

class PersonaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  nombreCompleto: string | null;
}

class FirmaCierreDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({
    description: 'Cuándo registró el profesional esa versión de su firma',
  })
  registradaEn: Date;
  @ApiProperty({ description: 'SHA-256 de la imagen estampada' })
  huellaSha256: string;
}

class InstitucionDestinoDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  nombre: string | null;
}

/** Para la lista de pacientes de un servicio: sin datos clínicos detallados. */
export class HistoriaClinicaResumenDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'HC-20261025-0001' })
  numeroHistoria: string;

  @ApiProperty({ enum: ESTADOS_HISTORIA })
  estado: EstadoHistoria;

  @ApiPropertyOptional({ type: String, nullable: true })
  numeroEmergencia: string | null;

  @ApiProperty({
    example: 'Juan Pérez',
    description: '"NN" si el paciente no está identificado',
  })
  paciente: string;

  @ApiPropertyOptional({ enum: TRIAGES, nullable: true })
  triage: Triage | null;

  @ApiPropertyOptional({ enum: DESENLACES, nullable: true })
  desenlace: Desenlace | null;

  @ApiProperty()
  abiertaEn: Date;

  @ApiPropertyOptional({ type: Date, nullable: true })
  cerradaEn: Date | null;

  static desde(historia: HistoriaClinica): HistoriaClinicaResumenDto {
    const d = historia.datos;
    const nombre = [d.nombres, d.apellidos].filter(Boolean).join(' ');
    return {
      id: historia.id,
      numeroHistoria: historia.numeroHistoria,
      estado: historia.estado,
      numeroEmergencia: historia.numeroEmergencia,
      paciente: d.pacienteIdentificado && nombre ? nombre : 'NN',
      triage: d.triage,
      desenlace: d.desenlace,
      abiertaEn: historia.abiertaEn,
      cerradaEn: historia.cerradaEn,
    };
  }
}

export class SignoVitalRespuestaDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() medidoEn: Date;
  @ApiPropertyOptional({ type: Number, nullable: true }) presionSistolica:
    number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) presionDiastolica:
    number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) frecuenciaCardiaca:
    number | null;
  @ApiPropertyOptional({ type: Number, nullable: true })
  frecuenciaRespiratoria: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) saturacionOxigeno:
    number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) temperatura:
    number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) glucometria:
    number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) glasgowOcular:
    number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) glasgowVerbal:
    number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) glasgowMotor:
    number | null;
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Calculado: ocular + verbal + motor',
  })
  glasgowTotal: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) escalaDolor:
    number | null;
  @ApiProperty({ type: PersonaDto }) registradoPor: PersonaDto;

  static desde(s: SignoVital): SignoVitalRespuestaDto {
    const {
      historiaClinicaId: _,
      registradoPorId,
      registradoPorNombre,
      ...resto
    } = s;
    return {
      ...resto,
      registradoPor: {
        id: registradoPorId,
        nombreCompleto: registradoPorNombre,
      },
    };
  }
}

export class LesionRespuestaDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: REGIONES_CORPORALES }) regionCorporal: string;
  @ApiProperty({ enum: TIPOS_LESION }) tipoLesion: string;
  @ApiPropertyOptional({ type: String, nullable: true }) descripcion:
    string | null;

  static desde(l: Lesion): LesionRespuestaDto {
    return {
      id: l.id,
      regionCorporal: l.regionCorporal,
      tipoLesion: l.tipoLesion,
      descripcion: l.descripcion,
    };
  }
}

export class IntervencionRespuestaDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: TIPOS_INTERVENCION }) tipo: string;
  @ApiProperty() nombre: string;
  @ApiPropertyOptional({ type: String, nullable: true }) dosis: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) via: string | null;
  @ApiPropertyOptional({ type: Date, nullable: true }) realizadoEn: Date | null;
  @ApiPropertyOptional({ type: String, nullable: true }) resultado:
    string | null;
  @ApiProperty({ type: PersonaDto }) registradoPor: PersonaDto;

  static desde(i: Intervencion): IntervencionRespuestaDto {
    const {
      historiaClinicaId: _,
      registradoPorId,
      registradoPorNombre,
      ...resto
    } = i;
    return {
      ...resto,
      registradoPor: {
        id: registradoPorId,
        nombreCompleto: registradoPorNombre,
      },
    };
  }
}

export class HistoriaClinicaDetalleDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'HC-20261025-0001' }) numeroHistoria: string;
  @ApiProperty({ enum: ESTADOS_HISTORIA }) estado: EstadoHistoria;
  @ApiProperty({ format: 'uuid' }) emergenciaId: string;
  @ApiPropertyOptional({ type: String, nullable: true }) numeroEmergencia:
    string | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  asignacionId: string | null;
  @ApiProperty({
    enum: MODALIDADES_SERVICIO,
    description:
      'Modalidad del servicio (la elige el despachador): define qué firmas se exigen al cerrar (catalogos.politicasFirma)',
  })
  modalidad: ModalidadServicio;
  @ApiProperty() abiertaEn: Date;
  @ApiPropertyOptional({ type: Date, nullable: true }) cerradaEn: Date | null;
  @ApiPropertyOptional({ type: Date, nullable: true })
  sincronizadaEn: Date | null;
  @ApiProperty({ type: PersonaDto }) creadaPor: PersonaDto;
  @ApiPropertyOptional({ type: PersonaDto, nullable: true })
  cerradaPor: PersonaDto | null;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Huella SHA-256 del contenido al cerrar',
  })
  hashCierre: string | null;
  @ApiPropertyOptional({
    type: FirmaCierreDto,
    nullable: true,
    description:
      'La firma registrada que se estampó al cerrar. Imagen en GET /historias-clinicas/{id}/firma-cierre/imagen',
  })
  firmaCierre: FirmaCierreDto | null;
  @ApiPropertyOptional({ type: InstitucionDestinoDto, nullable: true })
  institucionDestino: InstitucionDestinoDto | null;

  @ApiProperty({
    description:
      'Los mismos campos que se envían en PATCH. Valores: ' +
      `tipoDocumento ${TIPOS_DOCUMENTO.join('/')}; sexo ${SEXOS.join('/')}; ` +
      `regimenAfiliacion ${REGIMENES_AFILIACION.join('/')}; ` +
      `tipoEvento ${TIPOS_EVENTO.join('/')}; rolVictima ${ROLES_VICTIMA.join('/')}; ` +
      `triage ${TRIAGES.join('/')}; desenlace ${DESENLACES.join('/')}`,
  })
  datos: DatosHistoria;

  @ApiProperty({ type: [SignoVitalRespuestaDto] })
  signosVitales: SignoVitalRespuestaDto[];
  @ApiProperty({ type: [LesionRespuestaDto] }) lesiones: LesionRespuestaDto[];
  @ApiProperty({ type: [IntervencionRespuestaDto] })
  intervenciones: IntervencionRespuestaDto[];
  @ApiProperty({
    type: [ValoracionDowntonRespuestaDto],
    description:
      'Escala de riesgo de caídas J.H. Downton (opcional; de la más antigua a la más reciente)',
  })
  valoracionesDownton: ValoracionDowntonRespuestaDto[];
  @ApiProperty({
    type: [FirmaHistoriaRespuestaDto],
    description: 'Firmas del paciente, familiar, testigo y receptor',
  })
  firmasHistoria: FirmaHistoriaRespuestaDto[];

  @ApiProperty({
    type: [String],
    example: ['triage', 'desenlace'],
    description:
      'Lo que falta para poder cerrar (vacío = se puede cerrar). Solo tiene sentido en borrador',
  })
  faltantesParaCerrar: string[];

  static desde({
    historia,
    signosVitales,
    lesiones,
    intervenciones,
    valoracionesDownton,
    firmasHistoria,
  }: DetalleHistoria): HistoriaClinicaDetalleDto {
    return {
      id: historia.id,
      numeroHistoria: historia.numeroHistoria,
      estado: historia.estado,
      emergenciaId: historia.emergenciaId,
      numeroEmergencia: historia.numeroEmergencia,
      asignacionId: historia.asignacionId,
      modalidad: historia.modalidad,
      abiertaEn: historia.abiertaEn,
      cerradaEn: historia.cerradaEn,
      sincronizadaEn: historia.sincronizadaEn,
      creadaPor: {
        id: historia.creadaPorId,
        nombreCompleto: historia.creadaPorNombre,
      },
      cerradaPor: historia.cerradaPorId
        ? {
            id: historia.cerradaPorId,
            nombreCompleto: historia.cerradaPorNombre,
          }
        : null,
      hashCierre: historia.hashCierre,
      firmaCierre: historia.firmaCierre ? { ...historia.firmaCierre } : null,
      institucionDestino: historia.datos.institucionDestinoId
        ? {
            id: historia.datos.institucionDestinoId,
            nombre: historia.institucionDestinoNombre,
          }
        : null,
      datos: { ...historia.datos },
      signosVitales: signosVitales.map((s) => SignoVitalRespuestaDto.desde(s)),
      lesiones: lesiones.map((l) => LesionRespuestaDto.desde(l)),
      intervenciones: intervenciones.map((i) =>
        IntervencionRespuestaDto.desde(i),
      ),
      valoracionesDownton: valoracionesDownton.map((v) =>
        ValoracionDowntonRespuestaDto.desde(v),
      ),
      firmasHistoria: firmasHistoria.map((f) =>
        FirmaHistoriaRespuestaDto.desde(f),
      ),
      faltantesParaCerrar: historia.esBorrador()
        ? historia.faltantesParaCerrar({
            signosVitales: signosVitales.length,
            firmas: firmasHistoria.map(resumirFirma),
          })
        : [],
    };
  }
}

class DeclaracionFirmaDto {
  @ApiProperty({ example: 'v1' }) version: string;
  @ApiProperty() texto: string;
}

export class CatalogosClinicosDto {
  @ApiProperty({ type: [String] }) tiposDocumento: readonly string[];
  @ApiProperty({ type: [String] }) sexos: readonly string[];
  @ApiProperty({ type: [String] }) tiposEvento: readonly string[];
  @ApiProperty({ type: [String] }) rolesVictima: readonly string[];
  @ApiProperty({ type: [String] }) regimenesAfiliacion: readonly string[];
  @ApiProperty({ type: [String] }) triages: readonly string[];
  @ApiProperty({ type: [String] }) desenlaces: readonly string[];
  @ApiProperty({ type: [String] }) regionesCorporales: readonly string[];
  @ApiProperty({ type: [String] }) tiposLesion: readonly string[];
  @ApiProperty({ type: [String] }) tiposIntervencion: readonly string[];
  @ApiProperty({ type: [String], description: 'Escala Downton' })
  estadosMentales: readonly string[];
  @ApiProperty({ type: [String], description: 'Escala Downton' })
  deambulaciones: readonly string[];
  @ApiProperty({ type: [String], description: 'Escala Downton' })
  nivelesRiesgoCaida: readonly string[];
  @ApiProperty({ type: [String], description: 'Modalidades del servicio' })
  modalidades: readonly string[];
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Por modalidad: { comprobante: obligatoria | si_es_posible | opcional, receptor: obligatoria | opcional }. El disentimiento siempre es obligatorio',
  })
  politicasFirma: Record<string, unknown>;
  @ApiProperty({ type: [String] }) rolesFirmante: readonly string[];
  @ApiProperty({ type: [String] }) propositosFirma: readonly string[];
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Qué propósitos puede firmar cada rol',
  })
  propositosPorRol: Record<string, unknown>;
  @ApiProperty({
    type: [String],
    description: 'El acudiente debe ser familiar',
  })
  parentescos: readonly string[];
  @ApiProperty({ type: [String] }) motivosSinFirma: readonly string[];
  @ApiProperty({
    type: [String],
    description:
      'Documentos válidos para acudiente y testigo (mayores de edad)',
  })
  documentosAdulto: readonly string[];
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Por propósito: { version, texto } que se muestra al firmante',
  })
  textosFirma: Record<string, unknown>;
  @ApiProperty({
    type: DeclaracionFirmaDto,
    description: 'Texto que se muestra al firmar el cierre',
  })
  declaracionFirma: DeclaracionFirmaDto;

  static crear(): CatalogosClinicosDto {
    return {
      tiposDocumento: TIPOS_DOCUMENTO,
      sexos: SEXOS,
      tiposEvento: TIPOS_EVENTO,
      rolesVictima: ROLES_VICTIMA,
      regimenesAfiliacion: REGIMENES_AFILIACION,
      triages: TRIAGES,
      desenlaces: DESENLACES,
      regionesCorporales: REGIONES_CORPORALES,
      tiposLesion: TIPOS_LESION,
      tiposIntervencion: TIPOS_INTERVENCION,
      estadosMentales: ESTADOS_MENTALES,
      deambulaciones: DEAMBULACIONES,
      nivelesRiesgoCaida: NIVELES_RIESGO_CAIDA,
      declaracionFirma: { ...DECLARACION_FIRMA_HISTORIA },
      modalidades: MODALIDADES_SERVICIO,
      politicasFirma: { ...POLITICAS_FIRMA },
      rolesFirmante: ROLES_FIRMANTE,
      propositosFirma: PROPOSITOS_FIRMA,
      propositosPorRol: { ...PROPOSITOS_POR_ROL },
      parentescos: PARENTESCOS,
      motivosSinFirma: MOTIVOS_SIN_FIRMA,
      documentosAdulto: DOCUMENTOS_ADULTO,
      textosFirma: { ...TEXTOS_FIRMA },
    };
  }
}
