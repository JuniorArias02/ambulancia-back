import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import {
  FUNCIONES_TRIPULANTE,
  type FuncionTripulante,
  MAXIMO_INTEGRANTES,
} from '../../domain/entities/turno.entity.js';

export class IntegranteTurnoDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  usuarioId: string;

  @ApiProperty({
    enum: FUNCIONES_TRIPULANTE,
    description:
      'conductor: rol conductor · paramedico o medico: rol paramedico',
  })
  @IsIn(FUNCIONES_TRIPULANTE)
  funcion: FuncionTripulante;
}

export class IntegrantesTurnoDto {
  @ApiProperty({
    type: [IntegranteTurnoDto],
    minItems: 2,
    maxItems: MAXIMO_INTEGRANTES,
    description: 'Al menos un conductor y un paramédico o médico',
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(MAXIMO_INTEGRANTES)
  @ValidateNested({ each: true })
  @Type(() => IntegranteTurnoDto)
  integrantes: IntegranteTurnoDto[];
}
