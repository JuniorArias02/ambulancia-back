import { Body, Controller, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Roles } from '../../../../common/constants/roles.js';
import { Contexto } from '../../../../common/decorators/contexto.decorator.js';
import { RequiereRoles } from '../../../../common/decorators/requiere_roles.decorator.js';
import { UsuarioActual } from '../../../../common/decorators/usuario_actual.decorator.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import type { UsuarioAutenticado } from '../../../../common/types/usuario_autenticado.js';
import { AsignacionRespuestaDto } from '../../../assignments/presentation/dto/asignacion_respuesta.dto.js';
import { DefinirDestinoAsignacion } from '../../application/use-cases/definir_destino_asignacion.use-case.js';
import { DefinirDestinoAsignacionDto } from '../dto/definir_destino_asignacion.dto.js';

/** Vive aquí porque necesita las instituciones, y este módulo ya depende de asignaciones. */
@ApiTags('Asignaciones')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@Controller('asignaciones')
export class DestinoAsignacionController {
  constructor(private readonly definirDestino: DefinirDestinoAsignacion) {}

  @Put(':id/destino')
  @RequiereRoles(Roles.CONDUCTOR)
  @ApiOperation({
    summary: 'Elegir o cambiar el hospital de destino del traslado',
    description:
      'Solo el conductor del servicio. La central y el paramédico lo consultan en la asignación. Reintentar con el mismo hospital no cambia nada.',
  })
  @ApiOkResponse({ type: AsignacionRespuestaDto })
  @ApiForbiddenResponse({ description: 'No es el conductor de este servicio' })
  @ApiNotFoundResponse({
    description: 'La asignación o la institución no existe',
  })
  @ApiConflictResponse({
    description: 'El servicio cambió de estado mientras tanto',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Institución inactiva o sin coordenadas, o servicio fuera de en_escena, atendiendo y trasladando',
  })
  async definir(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DefinirDestinoAsignacionDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<AsignacionRespuestaDto> {
    return AsignacionRespuestaDto.desde(
      await this.definirDestino.ejecutar(
        id,
        dto.institucionId,
        { usuarioId: usuario.id, rol: usuario.rol },
        contexto,
      ),
    );
  }
}
