import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginacionDto } from '../../../../common/dto/paginacion.dto.js';
import {
  NIVELES_COMPLEJIDAD,
  type NivelComplejidad,
} from '../../domain/entities/institucion_salud.entity.js';

export class ConsultarInstitucionesSaludDto extends PaginacionDto {
  @ApiPropertyOptional({ description: 'Busca en nombre, código o dirección' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  busqueda?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  activa?: boolean;

  @ApiPropertyOptional({ enum: NIVELES_COMPLEJIDAD })
  @IsOptional()
  @IsIn(NIVELES_COMPLEJIDAD)
  nivelComplejidad?: NivelComplejidad;

  @ApiPropertyOptional({
    description:
      'Con latitud y longitud se ordenan de la más cercana a la más lejana',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitud?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitud?: number;
}
