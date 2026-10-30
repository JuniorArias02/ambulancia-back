import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
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
import { IniciarTurno } from '../../application/use-cases/iniciar_turno.use-case.js';
import { ObtenerTurno } from '../../application/use-cases/obtener_turno.use-case.js';
import { ReemplazarIntegrantesTurno } from '../../application/use-cases/reemplazar_integrantes_turno.use-case.js';
import { ConsultarTurnosDto } from '../dto/consultar_turnos.dto.js';
import { IniciarTurnoDto } from '../dto/iniciar_turno.dto.js';
import { IntegrantesTurnoDto } from '../dto/integrante_turno.dto.js';
import {
  TurnoRespuestaDto,
  TurnosPaginadosRespuestaDto,
} from '../dto/turno_respuesta.dto.js';

@ApiTags('Turnos')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({ description: 'Sin permisos para la operación' })
@RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR)
@Controller('turnos')
export class TurnosController {
  constructor(
    private readonly iniciarTurno: IniciarTurno,
    private readonly consultarTurnos: ConsultarTurnos,
    private readonly obtenerTurno: ObtenerTurno,
    private readonly reemplazarIntegrantesTurno: ReemplazarIntegrantesTurno,
    private readonly finalizarTurno: FinalizarTurno,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Iniciar el turno de una ambulancia con su tripulación',
  })
  @ApiCreatedResponse({ type: TurnoRespuestaDto })
  @ApiNotFoundResponse({ description: 'La ambulancia no existe' })
  @ApiConflictResponse({
    description: 'La ambulancia o un tripulante ya tienen un turno activo',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Tripulación incompleta, usuario inactivo o rol incompatible',
  })
  async iniciar(
    @Body() dto: IniciarTurnoDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<TurnoRespuestaDto> {
    return TurnoRespuestaDto.desde(
      await this.iniciarTurno.ejecutar(dto, contexto),
    );
  }

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

  @Put(':id/integrantes')
  @ApiOperation({ summary: 'Reemplazar la tripulación de un turno activo' })
  @ApiOkResponse({ type: TurnoRespuestaDto })
  @ApiNotFoundResponse()
  @ApiConflictResponse({
    description: 'Un tripulante ya está en otro turno activo',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Turno finalizado, tripulación incompleta o rol incompatible',
  })
  async reemplazarIntegrantes(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IntegrantesTurnoDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<TurnoRespuestaDto> {
    return TurnoRespuestaDto.desde(
      await this.reemplazarIntegrantesTurno.ejecutar(
        id,
        dto.integrantes,
        contexto,
      ),
    );
  }

  @Patch(':id/finalizar')
  @ApiOperation({
    summary:
      'Finalizar el turno (si la ambulancia estaba disponible, queda fuera de servicio)',
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
