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
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { ActualizarEmergencia } from '../../application/use-cases/actualizar_emergencia.use-case.js';
import { BuscarPosiblesDuplicadas } from '../../application/use-cases/buscar_posibles_duplicadas.use-case.js';
import { CancelarEmergencia } from '../../application/use-cases/cancelar_emergencia.use-case.js';
import { ConsultarEmergencias } from '../../application/use-cases/consultar_emergencias.use-case.js';
import { MarcarEmergenciaDuplicada } from '../../application/use-cases/marcar_emergencia_duplicada.use-case.js';
import { ObtenerEmergencia } from '../../application/use-cases/obtener_emergencia.use-case.js';
import { RegistrarEmergencia } from '../../application/use-cases/registrar_emergencia.use-case.js';
import { ActualizarEmergenciaDto } from '../dto/actualizar_emergencia.dto.js';
import { CancelarEmergenciaDto } from '../dto/cancelar_emergencia.dto.js';
import { ConsultarEmergenciasDto } from '../dto/consultar_emergencias.dto.js';
import {
  EmergenciaRespuestaDto,
  EmergenciasPaginadasRespuestaDto,
  PosibleDuplicadaRespuestaDto,
} from '../dto/emergencia_respuesta.dto.js';
import { MarcarDuplicadaDto } from '../dto/marcar_duplicada.dto.js';
import { RegistrarEmergenciaDto } from '../dto/registrar_emergencia.dto.js';

@ApiTags('Emergencias')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({ description: 'Sin permisos para la operación' })
@RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR)
@Controller('emergencias')
export class EmergenciasController {
  constructor(
    private readonly registrarEmergencia: RegistrarEmergencia,
    private readonly consultarEmergencias: ConsultarEmergencias,
    private readonly obtenerEmergencia: ObtenerEmergencia,
    private readonly actualizarEmergencia: ActualizarEmergencia,
    private readonly cancelarEmergencia: CancelarEmergencia,
    private readonly marcarEmergenciaDuplicada: MarcarEmergenciaDuplicada,
    private readonly buscarPosiblesDuplicadas: BuscarPosiblesDuplicadas,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Registrar una emergencia (nace recibida)' })
  @ApiCreatedResponse({ type: EmergenciaRespuestaDto })
  @ApiUnprocessableEntityResponse({
    description: 'Sin dirección ni coordenadas, o coordenadas incompletas',
  })
  async registrar(
    @Body() dto: RegistrarEmergenciaDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<EmergenciaRespuestaDto> {
    const emergencia = await this.registrarEmergencia.ejecutar(dto, contexto);
    return EmergenciaRespuestaDto.desde(emergencia);
  }

  @Get()
  @ApiOperation({
    summary:
      'Consultar emergencias con filtros, de la más reciente a la más antigua',
  })
  @ApiOkResponse({ type: EmergenciasPaginadasRespuestaDto })
  async consultar(
    @Query() { pagina, limite, ...filtros }: ConsultarEmergenciasDto,
  ): Promise<EmergenciasPaginadasRespuestaDto> {
    const resultado = await this.consultarEmergencias.ejecutar(filtros, {
      pagina,
      limite,
    });
    return EmergenciasPaginadasRespuestaDto.desde(resultado);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una emergencia' })
  @ApiOkResponse({ type: EmergenciaRespuestaDto })
  @ApiNotFoundResponse()
  async obtener(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EmergenciaRespuestaDto> {
    return EmergenciaRespuestaDto.desde(
      await this.obtenerEmergencia.ejecutar(id),
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Corregir los datos de una emergencia activa' })
  @ApiOkResponse({ type: EmergenciaRespuestaDto })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Otro usuario la modificó antes' })
  @ApiUnprocessableEntityResponse({
    description: 'Emergencia cerrada o cancelada, o ubicación inválida',
  })
  async actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarEmergenciaDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<EmergenciaRespuestaDto> {
    const emergencia = await this.actualizarEmergencia.ejecutar(
      id,
      dto,
      contexto,
    );
    return EmergenciaRespuestaDto.desde(emergencia);
  }

  @Patch(':id/cancelar')
  @ApiOperation({ summary: 'Cancelar una emergencia aún no despachada' })
  @ApiOkResponse({ type: EmergenciaRespuestaDto })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Otro usuario la modificó antes' })
  @ApiUnprocessableEntityResponse({ description: 'No está en estado recibida' })
  async cancelar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelarEmergenciaDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<EmergenciaRespuestaDto> {
    const emergencia = await this.cancelarEmergencia.ejecutar(
      { emergenciaId: id, motivo: dto.motivo },
      contexto,
    );
    return EmergenciaRespuestaDto.desde(emergencia);
  }

  @Patch(':id/duplicada')
  @ApiOperation({
    summary: 'Marcar como duplicada de otra emergencia (queda cancelada)',
  })
  @ApiOkResponse({ type: EmergenciaRespuestaDto })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Otro usuario la modificó antes' })
  @ApiUnprocessableEntityResponse({
    description: 'No está recibida, o la principal no es válida',
  })
  async marcarDuplicada(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarcarDuplicadaDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<EmergenciaRespuestaDto> {
    const emergencia = await this.marcarEmergenciaDuplicada.ejecutar(
      { emergenciaId: id, emergenciaPrincipalId: dto.emergenciaPrincipalId },
      contexto,
    );
    return EmergenciaRespuestaDto.desde(emergencia);
  }

  @Get(':id/posibles-duplicadas')
  @ApiOperation({
    summary:
      'Emergencias activas cercanas o con la misma dirección (solo sugerencias)',
  })
  @ApiOkResponse({ type: [PosibleDuplicadaRespuestaDto] })
  @ApiNotFoundResponse()
  async posiblesDuplicadas(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PosibleDuplicadaRespuestaDto[]> {
    const posibles = await this.buscarPosiblesDuplicadas.ejecutar(id);
    return posibles.map((posible) =>
      PosibleDuplicadaRespuestaDto.desde(posible),
    );
  }
}
