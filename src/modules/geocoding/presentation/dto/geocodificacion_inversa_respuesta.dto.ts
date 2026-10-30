import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ResultadoGeocodificacionInversa } from '../../application/use-cases/geocodificar_coordenadas.use-case.js';
import {
  PRECISIONES_UBICACION,
  type PrecisionUbicacion,
} from '../../domain/services/precision_ubicacion.js';

class PuntoRespuestaDto {
  @ApiProperty({ example: 4.685519 })
  latitud: number;

  @ApiProperty({ example: -74.052851 })
  longitud: number;
}

class ComponentesDireccionRespuestaDto {
  @ApiPropertyOptional({ type: String, nullable: true, example: 'Cl 100' })
  calle: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '19 61' })
  numero: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  barrio: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Bogotá' })
  ciudad: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  departamento: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '111211' })
  codigoPostal: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'co' })
  pais: string | null;
}

export class GeocodificacionInversaRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    type: PuntoRespuestaDto,
    description: 'El punto que se tocó en el mapa',
  })
  puntoSolicitado: PuntoRespuestaDto;

  @ApiProperty({
    example: 'Cl 100 19 61, 111211 Bogotá, DC, Colombia',
    description:
      'Dirección completa; en precisión "zona", solo barrio, municipio y departamento',
  })
  direccion: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Cl 100 19 61',
    description: 'Lo que conviene poner en el campo "dirección" del formulario',
  })
  lineaDireccion: string | null;

  @ApiProperty({ type: ComponentesDireccionRespuestaDto })
  componentes: ComponentesDireccionRespuestaDto;

  @ApiProperty({
    enum: PRECISIONES_UBICACION,
    description:
      'exacta: placa a ≤ 25 m · aproximada: calle cercana · zona: solo barrio o municipio',
  })
  precision: PrecisionUbicacion;

  @ApiProperty({
    example: 3.1,
    description: 'Distancia entre el punto y la dirección encontrada',
  })
  distanciaMetros: number;

  @ApiPropertyOptional({ type: PuntoRespuestaDto, nullable: true })
  coordenadasDireccion: PuntoRespuestaDto | null;

  @ApiProperty({ example: 'geoapify' })
  proveedor: string;

  @ApiProperty({ enum: ['almacenada', 'proveedor'] })
  origen: 'almacenada' | 'proveedor';

  @ApiProperty()
  geocodificadaEn: Date;

  /** Solo para resultados encontrados: el controlador rechaza los demás antes. */
  static desde(
    { geocodificacion, origen }: ResultadoGeocodificacionInversa,
    encontrada: {
      direccion: string;
      precision: PrecisionUbicacion;
      distanciaMetros: number;
    },
  ): GeocodificacionInversaRespuestaDto {
    return {
      id: geocodificacion.id,
      puntoSolicitado: geocodificacion.puntoSolicitado,
      direccion: encontrada.direccion,
      lineaDireccion: geocodificacion.lineaDireccion,
      componentes: { ...geocodificacion.componentes },
      precision: encontrada.precision,
      distanciaMetros: encontrada.distanciaMetros,
      coordenadasDireccion: geocodificacion.coordenadasDireccion,
      proveedor: geocodificacion.proveedor,
      origen,
      geocodificadaEn: geocodificacion.actualizadaEn,
    };
  }
}
