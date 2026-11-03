import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
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
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { ConsultarTurnos } from '../../application/use-cases/consultar_turnos.use-case.js';
import { FinalizarTurno } from '../../application/use-cases/finalizar_turno.use-case.js';
import { ObtenerTurno } from '../../application/use-cases/obtener_turno.use-case.js';
import { ConsultarTurnosDto } from '../dto/consultar_turnos.dto.js';
import {
  TurnoRespuestaDto,
  TurnosPaginadosRespuestaDto,
} from '../dto/turno_respuesta.dto.js';

/**
 * La tripulación la arma cada persona desde la app (`/mi-ambulancia`). La central
 * consulta los turnos y solo puede cerrar uno que quedó abierto.
 */
@ApiTags('Turnos')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({ description: 'Sin permisos para la operación' })
@RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR)
@Controller('turnos')
export class TurnosController {
  constructor(
    private readonly consultarTurnos: ConsultarTurnos,
    private readonly obtenerTurno: ObtenerTurno,
    private readonly finalizarTurno: FinalizarTurno,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Consultar turnos, del más reciente al más antiguo',
  })
  @ApiOkResponse({ type: TurnosPaginadosRespuestaDto })
  async consultar(
    @Query() { pagina, limite, ...filtros }: ConsultarTurnosDto,
  ): Promise<TurnosPaginadosRespuestaDto> {
    return TurnosPaginadosRespuestaDto.desde(
      await this.consultarTurnos.ejecutar(filtros, { pagina, limite }),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un turno' })
  @ApiOkResponse({ type: TurnoRespuestaDto })
  @ApiNotFoundResponse()
  async obtener(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TurnoRespuestaDto> {
    return TurnoRespuestaDto.desde(await this.obtenerTurno.ejecutar(id));
  }

  @Patch(':id/finalizar')
  @ApiOperation({
    summary:
      'Cerrar un turno que quedó abierto (si la ambulancia estaba disponible, queda fuera de servicio)',
  })
  @ApiOkResponse({ type: TurnoRespuestaDto })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Ya fue finalizado por otro usuario' })
  @ApiUnprocessableEntityResponse({
    description: 'Turno ya finalizado o ambulancia en servicio',
  })
  async finalizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<TurnoRespuestaDto> {
    return TurnoRespuestaDto.desde(
      await this.finalizarTurno.ejecutar(id, contexto),
    );
  }
}
