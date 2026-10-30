import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Roles } from '../../../../common/constants/roles.js';
import { RequiereRoles } from '../../../../common/decorators/requiere_roles.decorator.js';
import { UsuarioActual } from '../../../../common/decorators/usuario_actual.decorator.js';
import type { UsuarioAutenticado } from '../../../../common/types/usuario_autenticado.js';
import { ConsultarRecorrido } from '../../application/use-cases/consultar_recorrido.use-case.js';
import { ReportarUbicacion } from '../../application/use-cases/reportar_ubicacion.use-case.js';
import { ConsultarRecorridoDto } from '../dto/consultar_recorrido.dto.js';
import { ReportarUbicacionDto } from '../dto/reportar_ubicacion.dto.js';
import { UbicacionRegistradaRespuestaDto } from '../dto/ubicacion_respuesta.dto.js';

@ApiTags('Ubicaciones')
@ApiBearerAuth()
@Controller('ubicaciones')
export class UbicacionesController {
  constructor(
    private readonly reportarUbicacion: ReportarUbicacion,
    private readonly consultarRecorrido: ConsultarRecorrido,
  ) {}

  @Post()
  @RequiereRoles(Roles.CONDUCTOR, Roles.PARAMEDICO)
  @ApiOperation({
    summary:
      'Reportar la posición GPS de la ambulancia del turno activo (app móvil)',
  })
  @ApiCreatedResponse({ type: UbicacionRegistradaRespuestaDto })
  @ApiUnprocessableEntityResponse({
    description: 'Sin turno activo o fecha en el futuro',
  })
  async reportar(
    @Body() dto: ReportarUbicacionDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<UbicacionRegistradaRespuestaDto> {
    return UbicacionRegistradaRespuestaDto.desde(
      await this.reportarUbicacion.ejecutar({
        usuarioId: usuario.id,
        latitud: dto.latitud,
        longitud: dto.longitud,
        velocidad: dto.velocidad,
        registradaEn: dto.registradaEn,
      }),
    );
  }

  @Get()
  @RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR)
  @ApiOperation({
    summary:
      'Recorrido de una ambulancia o de un servicio, en orden cronológico',
  })
  @ApiOkResponse({ type: [UbicacionRegistradaRespuestaDto] })
  @ApiUnprocessableEntityResponse({
    description: 'Falta ambulanciaId o asignacionId',
  })
  async recorrido(
    @Query() { limite, ...filtros }: ConsultarRecorridoDto,
  ): Promise<UbicacionRegistradaRespuestaDto[]> {
    const puntos = await this.consultarRecorrido.ejecutar(filtros, limite);
    return puntos.map((p) => UbicacionRegistradaRespuestaDto.desde(p));
  }
}
