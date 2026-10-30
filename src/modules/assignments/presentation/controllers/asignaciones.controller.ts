import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { UsuarioActual } from '../../../../common/decorators/usuario_actual.decorator.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import type { UsuarioAutenticado } from '../../../../common/types/usuario_autenticado.js';
import { AvanzarAsignacion } from '../../application/use-cases/avanzar_asignacion.use-case.js';
import { ConsultarEventosAsignacion } from '../../application/use-cases/consultar_eventos_asignacion.use-case.js';
import { CancelarAsignacion } from '../../application/use-cases/cancelar_asignacion.use-case.js';
import { ConsultarAsignaciones } from '../../application/use-cases/consultar_asignaciones.use-case.js';
import { DespacharAmbulancia } from '../../application/use-cases/despachar_ambulancia.use-case.js';
import { ObtenerAsignacion } from '../../application/use-cases/obtener_asignacion.use-case.js';
import {
  AsignacionesPaginadasRespuestaDto,
  AsignacionRespuestaDto,
} from '../dto/asignacion_respuesta.dto.js';
import { AvanzarAsignacionDto } from '../dto/avanzar_asignacion.dto.js';
import { CancelarAsignacionDto } from '../dto/cancelar_asignacion.dto.js';
import { ConsultarAsignacionesDto } from '../dto/consultar_asignaciones.dto.js';
import { DespacharAmbulanciaDto } from '../dto/despachar_ambulancia.dto.js';
import { EventoAsignacionRespuestaDto } from '../dto/evento_asignacion_respuesta.dto.js';

@ApiTags('Asignaciones')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({ description: 'Sin permisos para la operación' })
@Controller('asignaciones')
export class AsignacionesController {
  constructor(
    private readonly despacharAmbulancia: DespacharAmbulancia,
    private readonly consultarAsignaciones: ConsultarAsignaciones,
    private readonly obtenerAsignacion: ObtenerAsignacion,
    private readonly avanzarAsignacion: AvanzarAsignacion,
    private readonly consultarEventos: ConsultarEventosAsignacion,
    private readonly cancelarAsignacion: CancelarAsignacion,
  ) {}

  @Post()
  @RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR)
  @ApiOperation({ summary: 'Despachar una ambulancia a una emergencia' })
  @ApiCreatedResponse({ type: AsignacionRespuestaDto })
  @ApiNotFoundResponse({
    description: 'La emergencia o la ambulancia no existen',
  })
  @ApiConflictResponse({
    description: 'La ambulancia o la emergencia cambiaron mientras tanto',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Ambulancia no disponible o sin turno; emergencia cerrada, cancelada o duplicada',
  })
  async despachar(
    @Body() dto: DespacharAmbulanciaDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<AsignacionRespuestaDto> {
    return AsignacionRespuestaDto.desde(
      await this.despacharAmbulancia.ejecutar(dto, contexto),
    );
  }

  @Get()
  @RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR)
  @ApiOperation({
    summary: 'Consultar asignaciones, de la más reciente a la más antigua',
  })
  @ApiOkResponse({ type: AsignacionesPaginadasRespuestaDto })
  async consultar(
    @Query() { pagina, limite, ...filtros }: ConsultarAsignacionesDto,
  ): Promise<AsignacionesPaginadasRespuestaDto> {
    return AsignacionesPaginadasRespuestaDto.desde(
      await this.consultarAsignaciones.ejecutar(filtros, { pagina, limite }),
    );
  }

  @Get(':id')
  @RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR)
  @ApiOperation({ summary: 'Obtener una asignación' })
  @ApiOkResponse({ type: AsignacionRespuestaDto })
  @ApiNotFoundResponse()
  async obtener(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AsignacionRespuestaDto> {
    return AsignacionRespuestaDto.desde(
      await this.obtenerAsignacion.ejecutar(id),
    );
  }

  @Patch(':id/avance')
  @RequiereRoles(
    Roles.ADMINISTRADOR,
    Roles.DESPACHADOR,
    Roles.CONDUCTOR,
    Roles.PARAMEDICO,
  )
  @ApiOperation({
    summary:
      'Registrar un paso del ciclo de atención. La llegada (en_escena) solo la confirma el conductor, con GPS. Repetir un paso ya hecho devuelve el servicio sin cambios',
  })
  @ApiOkResponse({ type: AsignacionRespuestaDto })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Alguien la actualizó al mismo tiempo' })
  @ApiUnprocessableEntityResponse({
    description:
      'Transición no permitida, llegada sin GPS o fuera del radio, cierre sin traslado sin observación',
  })
  async avanzar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AvanzarAsignacionDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<AsignacionRespuestaDto> {
    return AsignacionRespuestaDto.desde(
      await this.avanzarAsignacion.ejecutar(
        {
          asignacionId: id,
          estado: dto.estado,
          rolSolicitante: usuario.rol,
          posicion:
            dto.latitud !== undefined && dto.longitud !== undefined
              ? { latitud: dto.latitud, longitud: dto.longitud }
              : undefined,
          precisionMetros: dto.precisionMetros,
          observacion: dto.observacion,
          confirmarFueraDeRadio: dto.confirmarFueraDeRadio,
        },
        contexto,
      ),
    );
  }

  @Get(':id/eventos')
  @RequiereRoles(
    Roles.ADMINISTRADOR,
    Roles.DESPACHADOR,
    Roles.CONDUCTOR,
    Roles.PARAMEDICO,
  )
  @ApiOperation({
    summary:
      'Línea de tiempo del servicio: cada paso con fecha, hora, responsable y posición (la tripulación solo la del suyo)',
  })
  @ApiOkResponse({ type: [EventoAsignacionRespuestaDto] })
  @ApiNotFoundResponse()
  async eventos(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<EventoAsignacionRespuestaDto[]> {
    const eventos = await this.consultarEventos.ejecutar(id, {
      usuarioId: usuario.id,
      rol: usuario.rol,
    });
    return eventos.map((e) => EventoAsignacionRespuestaDto.desde(e));
  }

  @Patch(':id/cancelar')
  @RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR)
  @ApiOperation({
    summary:
      'Cancelar antes de llegar a la escena (la ambulancia queda disponible)',
  })
  @ApiOkResponse({ type: AsignacionRespuestaDto })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Alguien la actualizó al mismo tiempo' })
  @ApiUnprocessableEntityResponse({
    description: 'Ya está en escena, finalizada o cancelada',
  })
  async cancelar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelarAsignacionDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<AsignacionRespuestaDto> {
    return AsignacionRespuestaDto.desde(
      await this.cancelarAsignacion.ejecutar(
        { asignacionId: id, motivo: dto.motivo },
        contexto,
      ),
    );
  }
}
