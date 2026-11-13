import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { CANTIDAD_MAXIMA } from '../../domain/services/validaciones.js';

export const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Para actualizar campos obligatorios: se puede omitir, pero si se envía
 * (incluso `null`) se valida. `IsOptional` dejaría pasar `null`.
 */
export const SiSeEnvia = () =>
  ValidateIf((_objeto, valor) => valor !== undefined);

export const EsFecha = () =>
  Matches(PATRON_FECHA, {
    message: '$property debe tener el formato AAAA-MM-DD',
  });

/** "true"/"false" de la URL a booleano. */
export const BooleanoDeConsulta = () =>
  applyDecorators(
    Transform(({ value }) => value === true || value === 'true'),
    IsBoolean(),
  );

/** Hasta 3 decimales, como DECIMAL(12,3). */
export const EsCantidad = (minimo = 0) =>
  applyDecorators(
    IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 3 }),
    Min(minimo),
    Max(CANTIDAD_MAXIMA),
  );

/** Respuesta paginada: cada listado la extiende con su `datos`. */
export class PaginaRespuestaDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  pagina: number;

  @ApiProperty()
  limite: number;
}
