import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginacionDto } from '../../../../common/dto/paginacion.dto.js';
import {
  MODALIDADES_SERVICIO,
  type ModalidadServicio,
} from '../../../emergencies/domain/entities/emergencia.entity.js';
import {
  DESENLACES,
  type Desenlace,
  REGIMENES_AFILIACION,
  type RegimenAfiliacion,
  TIPOS_EVENTO,
  type TipoEvento,
  TRIAGES,
  type Triage,
} from '../../domain/catalogos_clinicos.js';
import {
  CAMPOS_FECHA_CONSULTA,
  type CampoFechaConsulta,
  ESTADOS_FILTRO_CONSULTA,
  type EstadoFiltroConsulta,
  ORDENES_CONSULTA,
  type OrdenConsulta,
} from '../../domain/consulta_clinica.js';

/** "true"/"false" de la URL a booleano. */
const BooleanoDeConsulta = () =>
  applyDecorators(
    Transform(({ value }) =>
      value === 'true' || value === true
        ? true
        : value === 'false' || value === false
          ? false
          : value,
    ),
    IsBoolean(),
  );

const EsDia = () =>
  Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: '$property debe tener el formato AAAA-MM-DD',
  });

export class BuscarHistoriasClinicasDto extends PaginacionDto {
  @ApiPropertyOptional({
    example: '2026-11-01',
    description: 'Día de Colombia (incluido)',
  })
  @IsOptional()
  @EsDia()
  desde?: string;

  @ApiPropertyOptional({
    example: '2026-11-14',
    description: 'Día de Colombia (incluido). Rango máximo: 366 días',
  })
  @IsOptional()
  @EsDia()
  hasta?: string;

  @ApiPropertyOptional({
    enum: CAMPOS_FECHA_CONSULTA,
    default: 'atencion',
    description:
      'atencion = apertura de la historia; evento = hora del evento; cierre = firma y cierre. También define el orden por fecha',
  })
  @IsOptional()
  @IsIn(CAMPOS_FECHA_CONSULTA)
  campoFecha?: CampoFechaConsulta;

  @ApiPropertyOptional({
    example: 'EMG-20261114-0003',
    description:
      'Número del ingreso (emergencia o servicio), completo o una parte',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  ingreso?: string;

  @ApiPropertyOptional({
    example: 'HC-20261114-0001',
    description: 'Número de historia, completo o una parte',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  numeroHistoria?: string;

  @ApiPropertyOptional({
    example: '1090123456',
    description:
      'Documento exacto del paciente (se ignoran puntos, guiones y espacios)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  documento?: string;

  @ApiPropertyOptional({
    example: 'juan pérez',
    description:
      'Nombre o apellido: cada palabra (mínimo 2 letras) debe coincidir con el inicio de una palabra. Sin distinguir mayúsculas ni tildes',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nombre?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Solo pacientes no identificados (NN)',
  })
  @IsOptional()
  @BooleanoDeConsulta()
  soloNn?: boolean;

  @ApiPropertyOptional({
    enum: ESTADOS_FILTRO_CONSULTA,
    default: 'vigentes',
    description:
      'vigentes = borrador (en curso) + cerrada. Las anuladas solo con anulada o todos',
  })
  @IsOptional()
  @IsIn(ESTADOS_FILTRO_CONSULTA)
  estado?: EstadoFiltroConsulta;

  @ApiPropertyOptional({ enum: TRIAGES })
  @IsOptional()
  @IsIn(TRIAGES)
  triage?: Triage;

  @ApiPropertyOptional({ enum: DESENLACES })
  @IsOptional()
  @IsIn(DESENLACES)
  desenlace?: Desenlace;

  @ApiPropertyOptional({ enum: TIPOS_EVENTO })
  @IsOptional()
  @IsIn(TIPOS_EVENTO)
  tipoEvento?: TipoEvento;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'true: alguna valoración Downton dio riesgo alto; false: ninguna',
  })
  @IsOptional()
  @BooleanoDeConsulta()
  riesgoCaidaAlto?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'true: cerradas con firma registrada; false: sin firma',
  })
  @IsOptional()
  @BooleanoDeConsulta()
  firmada?: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  ambulanciaId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  institucionDestinoId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Profesional que la creó o la cerró',
  })
  @IsOptional()
  @IsUUID()
  profesionalId?: string;

  @ApiPropertyOptional({
    description: 'EPS o aseguradora, una parte del nombre',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  eps?: string;

  @ApiPropertyOptional({ enum: REGIMENES_AFILIACION })
  @IsOptional()
  @IsIn(REGIMENES_AFILIACION)
  regimen?: RegimenAfiliacion;

  @ApiPropertyOptional({
    enum: MODALIDADES_SERVICIO,
    description: 'Modalidad del servicio (la del ingreso)',
  })
  @IsOptional()
  @IsIn(MODALIDADES_SERVICIO)
  modalidad?: ModalidadServicio;

  @ApiPropertyOptional({
    enum: ORDENES_CONSULTA,
    default: 'fecha_desc',
    description:
      'fecha_* usa la fecha de campoFecha; numero = número de historia; paciente = apellidos y nombres',
  })
  @IsOptional()
  @IsIn(ORDENES_CONSULTA)
  orden?: OrdenConsulta;
}

/** Trazabilidad: hasta 100 eventos por página. */
export class ConsultarTrazabilidadDto extends PaginacionDto {}

/** Los mismos filtros de la bandeja, sin paginación (máximo 5000 filas). */
export class ExportarHistoriasDto extends OmitType(BuscarHistoriasClinicasDto, [
  'pagina',
  'limite',
] as const) {}

export class BuscarPacientesDto extends PaginacionDto {
  @ApiPropertyOptional({
    example: '1090123456',
    description: 'Documento exacto (se ignoran puntos, guiones y espacios)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  documento?: string;

  @ApiPropertyOptional({
    example: 'pérez',
    description: 'Inicio de cada palabra del nombre o del apellido',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nombre?: string;
}

export class ConsultarIndicadoresDto {
  @ApiPropertyOptional({
    example: '2026-10-17',
    description: 'Día de Colombia. Por defecto, 30 días antes de "hasta"',
  })
  @IsOptional()
  @EsDia()
  desde?: string;

  @ApiPropertyOptional({
    example: '2026-11-15',
    description:
      'Día de Colombia (incluido). Por defecto, hoy. Máximo 366 días',
  })
  @IsOptional()
  @EsDia()
  hasta?: string;
}
