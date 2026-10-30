import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../../../common/constants/roles.js';
import { RequiereRoles } from '../../../../common/decorators/requiere_roles.decorator.js';
import { UsuarioActual } from '../../../../common/decorators/usuario_actual.decorator.js';
import type { UsuarioAutenticado } from '../../../../common/types/usuario_autenticado.js';
import { ObtenerMiServicio } from '../../application/use-cases/obtener_mi_servicio.use-case.js';
import { MiServicioRespuestaDto } from '../dto/asignacion_respuesta.dto.js';

@ApiTags('App móvil')
@ApiBearerAuth()
@Controller('mi-servicio')
export class MiServicioController {
  constructor(private readonly obtenerMiServicio: ObtenerMiServicio) {}

  @Get()
  @RequiereRoles(Roles.CONDUCTOR, Roles.PARAMEDICO)
  @ApiOperation({
    summary:
      'Turno activo del tripulante y el servicio en curso de su ambulancia',
  })
  @ApiOkResponse({ type: MiServicioRespuestaDto })
  async obtener(
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<MiServicioRespuestaDto> {
    return MiServicioRespuestaDto.desde(
      await this.obtenerMiServicio.ejecutar(usuario.id),
    );
  }
}
