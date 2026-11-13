import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginacionDto } from '../../../../common/dto/paginacion.dto.js';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import {
  ESTADOS_REGISTRO_SANITARIO,
  type EstadoRegistroSanitario,
  type RegistroSanitario,
  TIPOS_REGISTRO_SANITARIO,
  type TipoRegistroSanitario,
} from '../../domain/entities/registro_sanitario.entity.js';
import { EsFecha, PaginaRespuestaDto, SiSeEnvia } from './validadores.js';

const URL_SEGURA = { protocols: ['https', 'http'], require_protocol: true };

export class CrearRegistroSanitarioDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  insumoId: string;

  @ApiProperty({ maxLength: 100, example: 'INVIMA 2020M-0012345' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  numeroRegistro: string;

  @ApiProperty({ enum: TIPOS_REGISTRO_SANITARIO })
  @IsIn(TIPOS_REGISTRO_SANITARIO)
  tipoRegistro: TipoRegistroSanitario;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '2022-01-15',
    description: 'AAAA-MM-DD',
  })
  @IsOptional()
  @EsFecha()
  fechaExpedicion?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '2032-01-15',
    description: 'AAAA-MM-DD',
  })
  @IsOptional()
  @EsFecha()
  fechaVencimiento?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  titular?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 500,
    description: 'URL http(s) del soporte',
  })
  @IsOptional()
  @IsUrl(URL_SEGURA)
  @MaxLength(500)
  documentoUrl?: string | null;

  @ApiPropertyOptional({ enum: ESTADOS_REGISTRO_SANITARIO, default: 'vigente' })
  @IsOptional()
  @IsIn(ESTADOS_REGISTRO_SANITARIO)
  estado?: EstadoRegistroSanitario;
}

export class ActualizarRegistroSanitarioDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @SiSeEnvia()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  numeroRegistro?: string;

  @ApiPropertyOptional({ enum: TIPOS_REGISTRO_SANITARIO })
  @SiSeEnvia()
  @IsIn(TIPOS_REGISTRO_SANITARIO)
  tipoRegistro?: TipoRegistroSanitario;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @EsFecha()
  fechaExpedicion?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @EsFecha()
  fechaVencimiento?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  titular?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @IsOptional()
  @IsUrl(URL_SEGURA)
  @MaxLength(500)
  documentoUrl?: string | null;

  @ApiPropertyOptional({ enum: ESTADOS_REGISTRO_SANITARIO })
  @SiSeEnvia()
  @IsIn(ESTADOS_REGISTRO_SANITARIO)
  estado?: EstadoRegistroSanitario;
}

export class ConsultarRegistrosSanitariosDto extends PaginacionDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  insumoId?: string;

  @ApiPropertyOptional({ enum: ESTADOS_REGISTRO_SANITARIO })
  @IsOptional()
  @IsIn(ESTADOS_REGISTRO_SANITARIO)
  estado?: EstadoRegistroSanitario;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Los que vencen hasta esta fecha',
  })
  @IsOptional()
  @EsFecha()
  vencenHasta?: string;
}

export class RegistroSanitarioRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  insumoId: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  insumoNombre: string | null;

  @ApiProperty()
  numeroRegistro: string;

  @ApiProperty({ enum: TIPOS_REGISTRO_SANITARIO })
  tipoRegistro: TipoRegistroSanitario;

  @ApiPropertyOptional({ type: String, nullable: true })
  fechaExpedicion: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  fechaVencimiento: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  titular: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  documentoUrl: string | null;

  @ApiProperty({ enum: ESTADOS_REGISTRO_SANITARIO })
  estado: EstadoRegistroSanitario;

  @ApiProperty({
    description: 'Estado "vigente" y sin vencer hoy (hora de Colombia)',
  })
  vigenteHoy: boolean;

  @ApiProperty()
  creadoEn: Date;

  @ApiProperty()
  actualizadoEn: Date;

  static desde(
    registro: RegistroSanitario,
    hoy: string,
  ): RegistroSanitarioRespuestaDto {
    return {
      id: registro.id,
      insumoId: registro.insumoId,
      insumoNombre: registro.insumoNombre,
      numeroRegistro: registro.numeroRegistro,
      tipoRegistro: registro.tipoRegistro,
      fechaExpedicion: registro.fechaExpedicion,
      fechaVencimiento: registro.fechaVencimiento,
      titular: registro.titular,
      documentoUrl: registro.documentoUrl,
      estado: registro.estado,
      vigenteHoy: registro.estaVigente(hoy),
      creadoEn: registro.creadoEn,
      actualizadoEn: registro.actualizadoEn,
    };
  }
}

export class RegistrosSanitariosPaginadosRespuestaDto extends PaginaRespuestaDto {
  @ApiProperty({ type: [RegistroSanitarioRespuestaDto] })
  datos: RegistroSanitarioRespuestaDto[];

  static desde(
    resultado: ResultadoPaginado<RegistroSanitario>,
    hoy: string,
  ): RegistrosSanitariosPaginadosRespuestaDto {
    return {
      ...resultado,
      datos: resultado.datos.map((r) =>
        RegistroSanitarioRespuestaDto.desde(r, hoy),
      ),
    };
  }
}
