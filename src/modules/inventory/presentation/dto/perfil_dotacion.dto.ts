import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PaginacionDto } from '../../../../common/dto/paginacion.dto.js';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import type { PerfilDotacion } from '../../domain/entities/perfil_dotacion.entity.js';
import {
  BooleanoDeConsulta,
  EsCantidad,
  EsFecha,
  PaginaRespuestaDto,
  SiSeEnvia,
} from './validadores.js';

export class ActualizarDetallePerfilDto {
  @ApiPropertyOptional({ example: 4, description: 'Mayor que 0' })
  @SiSeEnvia()
  @EsCantidad(0.001)
  cantidadRequerida?: number;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 2,
    description: 'Por debajo es crítico; null = igual a la requerida',
  })
  @IsOptional()
  @EsCantidad()
  cantidadMinima?: number | null;

  @ApiPropertyOptional({ default: true })
  @SiSeEnvia()
  @IsBoolean()
  obligatorio?: boolean;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observaciones?: string | null;
}

export class DetallePerfilDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  insumoId: string;

  @ApiProperty({ example: 4 })
  @EsCantidad(0.001)
  cantidadRequerida: number;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 2 })
  @IsOptional()
  @EsCantidad()
  cantidadMinima?: number | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  obligatorio?: boolean;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observaciones?: string | null;
}

export class ActualizarPerfilDotacionDto {
  @ApiPropertyOptional({ maxLength: 150 })
  @SiSeEnvia()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre?: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descripcion?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '2026-11-01' })
  @IsOptional()
  @EsFecha()
  vigenteDesde?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '2027-10-31' })
  @IsOptional()
  @EsFecha()
  vigenteHasta?: string | null;
}

export class CrearPerfilDotacionDto {
  @ApiProperty({
    format: 'uuid',
    description: 'TAB, TAM… (GET /tipos-ambulancia)',
  })
  @IsUUID()
  tipoAmbulanciaId: string;

  @ApiProperty({ maxLength: 50, example: 'DOT-TAB' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  codigo: string;

  @ApiProperty({ maxLength: 150, example: 'Dotación básica TAB' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descripcion?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '2026-11-01' })
  @IsOptional()
  @EsFecha()
  vigenteDesde?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @EsFecha()
  vigenteHasta?: string | null;

  @ApiPropertyOptional({ type: [DetallePerfilDto], maxItems: 300 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => DetallePerfilDto)
  detalles?: DetallePerfilDto[];
}

export class ConsultarPerfilesDotacionDto extends PaginacionDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  tipoAmbulanciaId?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @BooleanoDeConsulta()
  activo?: boolean;

  @ApiPropertyOptional({ description: 'Todas las versiones de un código' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  codigo?: string;
}

export class DetallePerfilRespuestaDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) insumoId: string;
  @ApiProperty() insumoCodigo: string;
  @ApiProperty() insumoNombre: string;
  @ApiProperty() unidadMedida: string;
  @ApiProperty() cantidadRequerida: number;
  @ApiPropertyOptional({ type: Number, nullable: true }) cantidadMinima:
    number | null;
  @ApiProperty() obligatorio: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) observaciones:
    string | null;
}

export class PerfilDotacionRespuestaDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) tipoAmbulanciaId: string;
  @ApiPropertyOptional({ type: String, nullable: true, example: 'TAB' })
  tipoAmbulanciaNombre: string | null;
  @ApiProperty() codigo: string;
  @ApiProperty() nombre: string;
  @ApiProperty() version: number;
  @ApiPropertyOptional({ type: String, nullable: true }) descripcion:
    string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) vigenteDesde:
    string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) vigenteHasta:
    string | null;
  @ApiProperty({ description: 'Solo uno activo por tipo de ambulancia' })
  activo: boolean;
  @ApiProperty({ description: 'Activo y dentro de su vigencia hoy' })
  vigenteHoy: boolean;
  @ApiProperty() creadoEn: Date;
  @ApiProperty() actualizadoEn: Date;
  @ApiProperty({ type: [DetallePerfilRespuestaDto] })
  detalles: DetallePerfilRespuestaDto[];

  static desde(
    perfil: PerfilDotacion,
    hoy: string,
  ): PerfilDotacionRespuestaDto {
    return {
      id: perfil.id,
      tipoAmbulanciaId: perfil.tipoAmbulanciaId,
      tipoAmbulanciaNombre: perfil.tipoAmbulanciaNombre,
      codigo: perfil.codigo,
      nombre: perfil.nombre,
      version: perfil.version,
      descripcion: perfil.descripcion,
      vigenteDesde: perfil.vigenteDesde,
      vigenteHasta: perfil.vigenteHasta,
      activo: perfil.activo,
      vigenteHoy: perfil.vigenteEn(hoy),
      creadoEn: perfil.creadoEn,
      actualizadoEn: perfil.actualizadoEn,
      detalles: perfil.detalles.map((d) => ({
        id: d.id,
        insumoId: d.insumoId,
        insumoCodigo: d.insumoCodigo,
        insumoNombre: d.insumoNombre,
        unidadMedida: d.unidadMedida,
        cantidadRequerida: d.cantidadRequerida,
        cantidadMinima: d.cantidadMinima,
        obligatorio: d.obligatorio,
        observaciones: d.observaciones,
      })),
    };
  }
}

export class PerfilesDotacionPaginadosRespuestaDto extends PaginaRespuestaDto {
  @ApiProperty({ type: [PerfilDotacionRespuestaDto] })
  datos: PerfilDotacionRespuestaDto[];

  static desde(
    resultado: ResultadoPaginado<PerfilDotacion>,
    hoy: string,
  ): PerfilesDotacionPaginadosRespuestaDto {
    return {
      ...resultado,
      datos: resultado.datos.map((p) =>
        PerfilDotacionRespuestaDto.desde(p, hoy),
      ),
    };
  }
}
