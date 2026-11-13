import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PaginacionDto } from '../../../../common/dto/paginacion.dto.js';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import {
  ESTADOS_CONTEO,
  ESTADOS_VERIFICACION,
  type EstadoConteo,
  type EstadoVerificacion,
  LONGITUD_MAXIMA_RESOLUCION,
  MAXIMO_CONTEOS,
  TIPOS_VERIFICACION,
  type TipoVerificacion,
  type Verificacion,
} from '../../domain/entities/verificacion.entity.js';
import {
  BooleanoDeConsulta,
  EsCantidad,
  EsFecha,
  PaginaRespuestaDto,
} from './validadores.js';

export class IniciarVerificacionDto {
  @ApiProperty({ enum: TIPOS_VERIFICACION })
  @IsIn(TIPOS_VERIFICACION)
  tipo: TipoVerificacion;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observaciones?: string | null;
}

export class ConteoDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  insumoId: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    format: 'uuid',
    description: 'Obligatorio si el insumo va por lote',
  })
  @IsOptional()
  @IsUUID()
  loteId?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    format: 'uuid',
    description: 'Obligatorio si va por serie (0 o 1)',
  })
  @IsOptional()
  @IsUUID()
  equipoId?: string | null;

  @ApiProperty({ example: 3, description: 'Lo que hay físicamente' })
  @EsCantidad()
  cantidadEncontrada: number;

  @ApiPropertyOptional({
    enum: ESTADOS_CONTEO,
    nullable: true,
    description:
      'Si se omite lo calcula el servidor (conforme/faltante/sobrante, o vencido si el lote venció). "danado" exige observaciones',
  })
  @IsOptional()
  @IsIn(ESTADOS_CONTEO)
  estado?: EstadoConteo | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observaciones?: string | null;
}

export class RegistrarConteosDto {
  @ApiProperty({ type: [ConteoDto], minItems: 1, maxItems: MAXIMO_CONTEOS })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAXIMO_CONTEOS)
  @ValidateNested({ each: true })
  @Type(() => ConteoDto)
  conteos: ConteoDto[];
}

export class FinalizarVerificacionDto {
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observaciones?: string | null;
}

export class RevisarVerificacionDto {
  @ApiProperty({
    maxLength: LONGITUD_MAXIMA_RESOLUCION,
    example:
      'Faltante de gasas repuesto con MOV-20261113-1A2B3C4D; lote vencido dado de baja con MOV-20261113-5E6F7A8B',
    description:
      'Cómo se atendieron las novedades. Se recomienda citar los códigos de los movimientos',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(LONGITUD_MAXIMA_RESOLUCION)
  resolucion: string;
}

export class HistorialVerificacionesDto extends PaginacionDto {
  @ApiPropertyOptional({ enum: ESTADOS_VERIFICACION })
  @IsOptional()
  @IsIn(ESTADOS_VERIFICACION)
  estado?: EstadoVerificacion;

  @ApiPropertyOptional({ enum: TIPOS_VERIFICACION })
  @IsOptional()
  @IsIn(TIPOS_VERIFICACION)
  tipo?: TipoVerificacion;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Solo las que tienen novedades: false = pendientes de revisión; true = ya revisadas',
  })
  @IsOptional()
  @BooleanoDeConsulta()
  revisada?: boolean;

  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @EsFecha()
  desde?: string;

  @ApiPropertyOptional({ example: '2026-11-30' })
  @IsOptional()
  @EsFecha()
  hasta?: string;
}

export class ConsultarVerificacionesInventarioDto extends HistorialVerificacionesDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  ubicacionId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  responsableId?: string;
}

export class ConteoRespuestaDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) insumoId: string;
  @ApiProperty() insumoNombre: string;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  loteId: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) numeroLote:
    string | null;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  equipoId: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) numeroSerie:
    string | null;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    format: 'uuid',
    description: 'Elemento del perfil de dotación',
  })
  perfilDetalleId: string | null;
  @ApiProperty({ description: 'Lo que decía el sistema al contar' })
  cantidadEsperada: number;
  @ApiProperty() cantidadEncontrada: number;
  @ApiProperty({ enum: ESTADOS_CONTEO }) estado: EstadoConteo;
  @ApiPropertyOptional({ type: String, nullable: true }) observaciones:
    string | null;
  @ApiProperty() creadoEn: Date;
}

export class RevisionRespuestaDto {
  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  revisadaPorId: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  revisadaPorNombre: string | null;

  @ApiProperty()
  revisadaEn: Date;

  @ApiProperty()
  resolucion: string;
}

export class VerificacionRespuestaDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) ubicacionId: string;
  @ApiPropertyOptional({ type: String, nullable: true }) ubicacionNombre:
    string | null;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  turnoId: string | null;
  @ApiProperty({ format: 'uuid' }) responsableId: string;
  @ApiPropertyOptional({ type: String, nullable: true }) responsableNombre:
    string | null;
  @ApiProperty({ enum: TIPOS_VERIFICACION }) tipo: TipoVerificacion;
  @ApiProperty({ enum: ESTADOS_VERIFICACION }) estado: EstadoVerificacion;
  @ApiProperty() iniciadaEn: Date;
  @ApiPropertyOptional({ type: Date, nullable: true })
  finalizadaEn: Date | null;
  @ApiPropertyOptional({ type: String, nullable: true }) observaciones:
    string | null;
  @ApiProperty({ description: 'Conteos que no son "conforme"' })
  totalNovedades: number;
  @ApiProperty({
    description: 'Tiene novedades que la central aún no ha revisado',
  })
  pendienteDeRevision: boolean;
  @ApiPropertyOptional({
    type: RevisionRespuestaDto,
    nullable: true,
    description:
      'Cómo atendió la central las novedades; null si no se ha revisado',
  })
  revision: RevisionRespuestaDto | null;
  @ApiProperty({ type: [ConteoRespuestaDto] }) conteos: ConteoRespuestaDto[];

  static desde(verificacion: Verificacion): VerificacionRespuestaDto {
    return {
      id: verificacion.id,
      ubicacionId: verificacion.ubicacionId,
      ubicacionNombre: verificacion.ubicacionNombre,
      turnoId: verificacion.turnoId,
      responsableId: verificacion.responsableId,
      responsableNombre: verificacion.responsableNombre,
      tipo: verificacion.tipo,
      estado: verificacion.estado,
      iniciadaEn: verificacion.iniciadaEn,
      finalizadaEn: verificacion.finalizadaEn,
      observaciones: verificacion.observaciones,
      totalNovedades: verificacion.conteos.filter(
        (c) => c.estado !== 'conforme',
      ).length,
      pendienteDeRevision: verificacion.estaPendienteDeRevision(),
      revision: verificacion.revision ? { ...verificacion.revision } : null,
      conteos: verificacion.conteos.map((c) => ({
        id: c.id,
        insumoId: c.insumoId,
        insumoNombre: c.insumoNombre,
        loteId: c.loteId,
        numeroLote: c.numeroLote,
        equipoId: c.equipoId,
        numeroSerie: c.numeroSerie,
        perfilDetalleId: c.perfilDetalleId,
        cantidadEsperada: c.cantidadEsperada,
        cantidadEncontrada: c.cantidadEncontrada,
        estado: c.estado,
        observaciones: c.observaciones,
        creadoEn: c.creadoEn,
      })),
    };
  }
}

export class VerificacionIniciadaRespuestaDto extends VerificacionRespuestaDto {
  @ApiProperty({ description: 'false: ya había una abierta y se devolvió esa' })
  creada: boolean;

  static desdeIniciada(
    verificacion: Verificacion,
    creada: boolean,
  ): VerificacionIniciadaRespuestaDto {
    return Object.assign(VerificacionRespuestaDto.desde(verificacion), {
      creada,
    });
  }
}

export class VerificacionAbiertaRespuestaDto {
  @ApiPropertyOptional({ type: VerificacionRespuestaDto, nullable: true })
  verificacion: VerificacionRespuestaDto | null;
}

export class VerificacionesInventarioPaginadasRespuestaDto extends PaginaRespuestaDto {
  @ApiProperty({ type: [VerificacionRespuestaDto] })
  datos: VerificacionRespuestaDto[];

  static desde(
    resultado: ResultadoPaginado<Verificacion>,
  ): VerificacionesInventarioPaginadasRespuestaDto {
    return {
      ...resultado,
      datos: resultado.datos.map((v) => VerificacionRespuestaDto.desde(v)),
    };
  }
}
