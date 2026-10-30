import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  DESENLACES,
  type Desenlace,
  ESTADOS_HISTORIA,
  type EstadoHistoria,
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
import type { DetalleHistoria } from '../../domain/repositories/historias_clinicas.repository.js';

class PersonaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  nombreCompleto: string | null;
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
  @ApiPropertyOptional({ type: InstitucionDestinoDto, nullable: true })
  institucionDestino: InstitucionDestinoDto | null;

  @ApiProperty({
    description:
      'Los mismos campos que se envían en PATCH. Valores: ' +
      `tipoDocumento ${TIPOS_DOCUMENTO.join('/')}; sexo ${SEXOS.join('/')}; ` +
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
  }: DetalleHistoria): HistoriaClinicaDetalleDto {
    return {
      id: historia.id,
      numeroHistoria: historia.numeroHistoria,
      estado: historia.estado,
      emergenciaId: historia.emergenciaId,
      numeroEmergencia: historia.numeroEmergencia,
      asignacionId: historia.asignacionId,
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
      faltantesParaCerrar: historia.esBorrador()
        ? historia.faltantesParaCerrar({ signosVitales: signosVitales.length })
        : [],
    };
  }
}

export class CatalogosClinicosDto {
  @ApiProperty({ type: [String] }) tiposDocumento: readonly string[];
  @ApiProperty({ type: [String] }) sexos: readonly string[];
  @ApiProperty({ type: [String] }) tiposEvento: readonly string[];
  @ApiProperty({ type: [String] }) rolesVictima: readonly string[];
  @ApiProperty({ type: [String] }) triages: readonly string[];
  @ApiProperty({ type: [String] }) desenlaces: readonly string[];
  @ApiProperty({ type: [String] }) regionesCorporales: readonly string[];
  @ApiProperty({ type: [String] }) tiposLesion: readonly string[];
  @ApiProperty({ type: [String] }) tiposIntervencion: readonly string[];

  static crear(): CatalogosClinicosDto {
    return {
      tiposDocumento: TIPOS_DOCUMENTO,
      sexos: SEXOS,
      tiposEvento: TIPOS_EVENTO,
      rolesVictima: ROLES_VICTIMA,
      triages: TRIAGES,
      desenlaces: DESENLACES,
      regionesCorporales: REGIONES_CORPORALES,
      tiposLesion: TIPOS_LESION,
      tiposIntervencion: TIPOS_INTERVENCION,
    };
  }
}
