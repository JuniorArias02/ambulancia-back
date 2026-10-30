import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Roles } from '../../../../common/constants/roles.js';
import { RequiereRoles } from '../../../../common/decorators/requiere_roles.decorator.js';
import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import { GeocodificarCoordenadas } from '../../application/use-cases/geocodificar_coordenadas.use-case.js';
import { GeocodificarDireccion } from '../../application/use-cases/geocodificar_direccion.use-case.js';
import { DireccionGeocodificadaRespuestaDto } from '../dto/direccion_geocodificada_respuesta.dto.js';
import { GeocodificacionInversaRespuestaDto } from '../dto/geocodificacion_inversa_respuesta.dto.js';
import { GeocodificarCoordenadasDto } from '../dto/geocodificar_coordenadas.dto.js';
import { GeocodificarDireccionDto } from '../dto/geocodificar_direccion.dto.js';

@ApiTags('Geocodificación')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({ description: 'Sin permisos para la operación' })
@Controller('geocodificacion')
export class GeocodificacionController {
  constructor(
    private readonly geocodificarDireccion: GeocodificarDireccion,
    private readonly geocodificarCoordenadas: GeocodificarCoordenadas,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR)
  // Cuida la cuota del proveedor: un formulario no necesita más.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Obtener las coordenadas de una dirección (reutiliza las ya geocodificadas)',
  })
  @ApiOkResponse({ type: DireccionGeocodificadaRespuestaDto })
  @ApiUnprocessableEntityResponse({
    description: 'No se encontró una ubicación confiable para la dirección',
  })
  @ApiTooManyRequestsResponse({ description: 'Más de 30 consultas por minuto' })
  @ApiServiceUnavailableResponse({
    description:
      'Proveedor sin configurar, sin respuesta o con la cuota agotada',
  })
  async geocodificar(
    @Body() dto: GeocodificarDireccionDto,
  ): Promise<DireccionGeocodificadaRespuestaDto> {
    const resultado = await this.geocodificarDireccion.ejecutar({
      direccion: dto.direccion,
      ciudad: dto.ciudad,
    });
    const { coordenadas } = resultado.direccion;
    if (!resultado.direccion.fueEncontrada() || !coordenadas) {
      throw new ReglaNegocioError(
        'No se encontró una ubicación confiable para esa dirección; verifíquela, indique la ciudad o marque el punto en el mapa',
      );
    }
    return DireccionGeocodificadaRespuestaDto.desde(resultado, coordenadas);
  }

  @Post('inversa')
  @HttpCode(HttpStatus.OK)
  @RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR)
  // Más holgado que la búsqueda: el despachador puede tocar varias veces el mapa.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Obtener la dirección de un punto del mapa (reutiliza los puntos ya consultados)',
  })
  @ApiOkResponse({ type: GeocodificacionInversaRespuestaDto })
  @ApiUnprocessableEntityResponse({
    description:
      'No hay ninguna dirección ni municipio conocido en ese punto, o está fuera del país',
  })
  @ApiTooManyRequestsResponse({ description: 'Más de 60 consultas por minuto' })
  @ApiServiceUnavailableResponse({
    description:
      'Proveedor sin configurar, sin respuesta o con la cuota agotada',
  })
  async geocodificarInverso(
    @Body() dto: GeocodificarCoordenadasDto,
  ): Promise<GeocodificacionInversaRespuestaDto> {
    const resultado = await this.geocodificarCoordenadas.ejecutar({
      latitud: dto.latitud,
      longitud: dto.longitud,
    });
    const { direccion, precision, distanciaMetros } = resultado.geocodificacion;
    if (!direccion || !precision || distanciaMetros === null) {
      throw new ReglaNegocioError(
        'No se encontró una dirección para ese punto; escríbala a mano',
      );
    }
    return GeocodificacionInversaRespuestaDto.desde(resultado, {
      direccion,
      precision,
      distanciaMetros,
    });
  }
}
