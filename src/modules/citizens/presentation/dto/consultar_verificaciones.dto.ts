import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginacionDto } from '../../../../common/dto/paginacion.dto.js';
import {
  ESTADOS_VERIFICACION,
  type EstadoVerificacion,
} from '../../domain/entities/verificacion_identidad.entity.js';

export class ConsultarVerificacionesDto extends PaginacionDto {
  @ApiPropertyOptional({
    enum: ESTADOS_VERIFICACION,
    description: 'Sin filtro, todas; ordenadas de la que más lleva esperando',
  })
  @IsOptional()
  @IsIn(ESTADOS_VERIFICACION)
  estado?: EstadoVerificacion;

  @ApiPropertyOptional({
    description: 'Nombres, apellidos, número de documento o correo',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  busqueda?: string;
}
