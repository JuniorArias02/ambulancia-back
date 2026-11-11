import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { LONGITUDES_LISTA } from '../../domain/entities/lista_chequeo.entity.js';

export class ActualizarListaChequeoDto {
  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(LONGITUDES_LISTA.nombre)
  nombre?: string;

  @ApiPropertyOptional({ maxLength: 255, description: 'Vacío la borra' })
  @IsOptional()
  @IsString()
  @MaxLength(LONGITUDES_LISTA.descripcion)
  descripcion?: string;
}

export class CambiarEstadoListaChequeoDto {
  @ApiProperty({ description: 'true activa esta lista y desactiva las demás' })
  @IsBoolean()
  activa: boolean;
}
