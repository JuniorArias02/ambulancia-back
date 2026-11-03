import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../../../common/constants/roles.js';
import { RequiereRoles } from '../../../../common/decorators/requiere_roles.decorator.js';
import { UsuarioActual } from '../../../../common/decorators/usuario_actual.decorator.js';
import type { UsuarioAutenticado } from '../../../../common/types/usuario_autenticado.js';
import { ConsultarRutasActivas } from '../../application/use-cases/consultar_rutas_activas.use-case.js';
import { ObtenerRutaAsignacion } from '../../application/use-cases/obtener_ruta_asignacion.use-case.js';
import { RutaRespuestaDto } from '../dto/ruta_respuesta.dto.js';

@ApiTags('Rutas')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({ description: 'Sin permisos para la operación' })
@Controller()
export class RutasController {
  constructor(
    private readonly obtenerRuta: ObtenerRutaAsignacion,
    private readonly consultarRutasActivas: ConsultarRutasActivas,
  ) {}

  @Get('rutas/activas')
  @RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR)
  @ApiOperation({
    summary:
      'Ruta vigente de cada ambulancia que va hacia una emergencia o un hospital (mapa del despacho)',
  })
  @ApiOkResponse({ type: [RutaRespuestaDto] })
  async activas(): Promise<RutaRespuestaDto[]> {
    const rutas = await this.consultarRutasActivas.ejecutar();
    return rutas.map((r) => RutaRespuestaDto.desde(r));
  }

  @Get('asignaciones/:id/ruta')
  @RequiereRoles(
    Roles.ADMINISTRADOR,
    Roles.DESPACHADOR,
    Roles.CONDUCTOR,
    Roles.PARAMEDICO,
  )
  @ApiOperation({
    summary: 'Ruta vigente de un servicio (la tripulación solo la del suyo)',
  })
  @ApiOkResponse({ type: RutaRespuestaDto })
  @ApiNotFoundResponse({
    description:
      'La asignación no existe o no tiene ruta vigente: en la escena, sin hospital elegido, sin GPS reciente o sin coordenadas',
  })
  async deAsignacion(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<RutaRespuestaDto> {
    return RutaRespuestaDto.desde(
      await this.obtenerRuta.ejecutar(id, {
        usuarioId: usuario.id,
        rol: usuario.rol,
      }),
    );
  }
}
