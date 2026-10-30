import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ResultadoGeocodificacion } from '../../application/use-cases/geocodificar_direccion.use-case.js';

class CoordenadasGeocodificadasDto {
  @ApiProperty({ example: 4.6573 })
  latitud: number;

  @ApiProperty({ example: -74.0601 })
  longitud: number;
}

export class DireccionGeocodificadaRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Calle 72 # 15-20' })
  direccionOriginal: string;

  @ApiProperty({
    example: 'co|bogota|calle 72 15 20',
    description:
      'Clave usada para reutilizar resultados (país|ciudad|dirección)',
  })
  direccionNormalizada: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  ciudad: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Calle 72 #15-20, Bogotá, Colombia',
    description:
      'Dirección según el proveedor; muéstrela para que el usuario confirme',
  })
  direccionFormateada: string | null;

  @ApiProperty({ type: CoordenadasGeocodificadasDto })
  coordenadas: CoordenadasGeocodificadasDto;

  @ApiProperty({ example: 'geoapify' })
  proveedor: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  proveedorResultadoId: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 0.95 })
  confianza: number | null;

  @ApiProperty({
    enum: ['almacenada', 'proveedor'],
    description: 'almacenada: se reutilizó sin consultar la API',
  })
  origen: 'almacenada' | 'proveedor';

  @ApiProperty()
  geocodificadaEn: Date;

  /** Solo para resultados encontrados: el controlador rechaza los demás antes. */
  static desde(
    { direccion, origen }: ResultadoGeocodificacion,
    coordenadas: CoordenadasGeocodificadasDto,
  ): DireccionGeocodificadaRespuestaDto {
    return {
      id: direccion.id,
      direccionOriginal: direccion.direccionOriginal,
      direccionNormalizada: direccion.direccionNormalizada,
      ciudad: direccion.ciudad,
      direccionFormateada: direccion.direccionFormateada,
      coordenadas,
      proveedor: direccion.proveedor,
      proveedorResultadoId: direccion.proveedorResultadoId,
      confianza: direccion.confianza,
      origen,
      geocodificadaEn: direccion.actualizadaEn,
    };
  }
}
