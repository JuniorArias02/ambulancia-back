import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';
import {
  TIPOS_UBICACION,
  type TipoUbicacion,
  type UbicacionInventario,
} from '../../domain/entities/ubicacion_inventario.entity.js';
import { BooleanoDeConsulta } from './validadores.js';

export class HabilitarAmbulanciaDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ambulanciaId: string;
}

export class CambiarEstadoUbicacionDto {
  @ApiProperty({
    description: 'Una ubicación inactiva no recibe ni entrega movimientos',
  })
  @IsBoolean()
  activa: boolean;
}

export class ConsultarUbicacionesDto {
  @ApiPropertyOptional({ enum: TIPOS_UBICACION })
  @IsOptional()
  @IsIn(TIPOS_UBICACION)
  tipo?: TipoUbicacion;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @BooleanoDeConsulta()
  activa?: boolean;
}

export class UbicacionInventarioRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: TIPOS_UBICACION })
  tipo: TipoUbicacion;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Nombre de la bodega o código de la ambulancia',
  })
  nombre: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  bodegaId: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  ambulanciaId: string | null;

  @ApiProperty()
  activa: boolean;

  static desde(
    ubicacion: UbicacionInventario,
  ): UbicacionInventarioRespuestaDto {
    return {
      id: ubicacion.id,
      tipo: ubicacion.tipo,
      nombre: ubicacion.nombre,
      bodegaId: ubicacion.bodegaId,
      ambulanciaId: ubicacion.ambulanciaId,
      activa: ubicacion.activa,
    };
  }
}
