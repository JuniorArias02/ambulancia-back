import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { LONGITUDES_LISTA } from '../../domain/entities/lista_chequeo.entity.js';

export class CrearPreguntaDto {
  @ApiProperty({ example: '¿Nivel de aceite del motor?', maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(LONGITUDES_LISTA.pregunta)
  pregunta: string;

  @ApiPropertyOptional({ minimum: 0, description: 'Si no viene, su posición' })
  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  obligatorio?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  permiteObservacion?: boolean;
}

export class CrearOpcionDto {
  @ApiProperty({ example: 'Bien', maxLength: 60 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(LONGITUDES_LISTA.nombreEstado)
  nombre: string;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 2,
    description: 'Puntaje opcional',
  })
  @IsOptional()
  @IsInt()
  valor?: number | null;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;
}

export class CrearListaChequeoDto {
  @ApiProperty({ example: 'Chequeo diario de ambulancia', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(LONGITUDES_LISTA.nombre)
  nombre: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(LONGITUDES_LISTA.descripcion)
  descripcion?: string;

  @ApiProperty({ type: [CrearPreguntaDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  // Sin @Type no se validan los elementos ni se rechazan sus campos de más.
  @ValidateNested({ each: true })
  @Type(() => CrearPreguntaDto)
  items: CrearPreguntaDto[];

  @ApiProperty({ type: [CrearOpcionDto], minItems: 2 })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CrearOpcionDto)
  estados: CrearOpcionDto[];
}
