import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginacionDto } from '../../../../common/dto/paginacion.dto.js';

export class ConsultarListasChequeoDto extends PaginacionDto {
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  activa?: boolean;

  @ApiPropertyOptional({ description: 'Busca en el nombre' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  busqueda?: string;
}
