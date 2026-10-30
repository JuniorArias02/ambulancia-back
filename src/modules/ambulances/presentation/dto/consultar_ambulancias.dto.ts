import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginacionDto } from '../../../../common/dto/paginacion.dto.js';
import {
  ESTADOS_OPERATIVOS,
  type EstadoOperativo,
} from '../../domain/entities/ambulancia.entity.js';

export class ConsultarAmbulanciasDto extends PaginacionDto {
  @ApiPropertyOptional({ description: 'Busca en código o placa' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  busqueda?: string;

  @ApiPropertyOptional({ enum: ESTADOS_OPERATIVOS })
  @IsOptional()
  @IsIn(ESTADOS_OPERATIVOS)
  estadoOperativo?: EstadoOperativo;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  tipoAmbulanciaId?: string;
}
