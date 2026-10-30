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
import { PaginacionDto } from '../../../../common/dto/paginacion.dto.js';
import { Roles } from '../../../../common/constants/roles.js';
import { Contexto } from '../../../../common/decorators/contexto.decorator.js';
import { RequiereRoles } from '../../../../common/decorators/requiere_roles.decorator.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { ActualizarAmbulancia } from '../../application/use-cases/actualizar_ambulancia.use-case.js';
import { CambiarEstadoAmbulancia } from '../../application/use-cases/cambiar_estado_ambulancia.use-case.js';
import { ConsultarAmbulancias } from '../../application/use-cases/consultar_ambulancias.use-case.js';
import { ConsultarHistorialEstadosAmbulancia } from '../../application/use-cases/consultar_historial_estados_ambulancia.use-case.js';
import { CrearAmbulancia } from '../../application/use-cases/crear_ambulancia.use-case.js';
import { ObtenerAmbulancia } from '../../application/use-cases/obtener_ambulancia.use-case.js';
import { ActualizarAmbulanciaDto } from '../dto/actualizar_ambulancia.dto.js';
import {
  AmbulanciaRespuestaDto,
  AmbulanciasPaginadasRespuestaDto,
} from '../dto/ambulancia_respuesta.dto.js';
import { CambiarEstadoAmbulanciaDto } from '../dto/cambiar_estado_ambulancia.dto.js';
import { HistorialEstadosRespuestaDto } from '../dto/cambio_estado_respuesta.dto.js';
import { ConsultarAmbulanciasDto } from '../dto/consultar_ambulancias.dto.js';
import { CrearAmbulanciaDto } from '../dto/crear_ambulancia.dto.js';

@ApiTags('Ambulancias')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({ description: 'Sin permisos para la operación' })
@Controller('ambulancias')
export class AmbulanciasController {
  constructor(
    private readonly crearAmbulancia: CrearAmbulancia,
    private readonly consultarAmbulancias: ConsultarAmbulancias,
    private readonly obtenerAmbulancia: ObtenerAmbulancia,
    private readonly actualizarAmbulancia: ActualizarAmbulancia,
    private readonly cambiarEstadoAmbulancia: CambiarEstadoAmbulancia,
    private readonly consultarHistorialEstados: ConsultarHistorialEstadosAmbulancia,
  ) {}

  @Post()
  @RequiereRoles(Roles.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Registrar una ambulancia (nace fuera de servicio)',
  })
  @ApiCreatedResponse({ type: AmbulanciaRespuestaDto })
  @ApiConflictResponse({ description: 'Código o placa ya registrados' })
  @ApiUnprocessableEntityResponse({
    description: 'Tipo de ambulancia inexistente',
  })
  async crear(
    @Body() dto: CrearAmbulanciaDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<AmbulanciaRespuestaDto> {
    const ambulancia = await this.crearAmbulancia.ejecutar(dto, contexto);
    return AmbulanciaRespuestaDto.desde(ambulancia);
  }

  @Get()
  @RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR)
  @ApiOperation({ summary: 'Consultar ambulancias con filtros y paginación' })
  @ApiOkResponse({ type: AmbulanciasPaginadasRespuestaDto })
  async consultar(
    @Query() { pagina, limite, ...filtros }: ConsultarAmbulanciasDto,
  ): Promise<AmbulanciasPaginadasRespuestaDto> {
    const resultado = await this.consultarAmbulancias.ejecutar(filtros, {
      pagina,
      limite,
    });
    return AmbulanciasPaginadasRespuestaDto.desde(resultado);
  }

  @Get(':id')
  @RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR)
  @ApiOperation({ summary: 'Obtener una ambulancia' })
  @ApiOkResponse({ type: AmbulanciaRespuestaDto })
  @ApiNotFoundResponse()
  async obtener(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AmbulanciaRespuestaDto> {
    return AmbulanciaRespuestaDto.desde(
      await this.obtenerAmbulancia.ejecutar(id),
    );
  }

  @Patch(':id')
  @RequiereRoles(Roles.ADMINISTRADOR)
  @ApiOperation({ summary: 'Editar código, placa o tipo de una ambulancia' })
  @ApiOkResponse({ type: AmbulanciaRespuestaDto })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Código o placa ya registrados' })
  @ApiUnprocessableEntityResponse({
    description: 'Ambulancia en servicio o tipo inexistente',
  })
  async actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarAmbulanciaDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<AmbulanciaRespuestaDto> {
    const ambulancia = await this.actualizarAmbulancia.ejecutar(
      id,
      dto,
      contexto,
    );
    return AmbulanciaRespuestaDto.desde(ambulancia);
  }

  @Patch(':id/estado')
  @RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR)
  @ApiOperation({
    summary:
      'Cambiar el estado operativo (disponible, fuera de servicio, mantenimiento)',
  })
  @ApiOkResponse({ type: AmbulanciaRespuestaDto })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Otro usuario cambió el estado antes' })
  @ApiUnprocessableEntityResponse({ description: 'Transición no permitida' })
  async cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoAmbulanciaDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<AmbulanciaRespuestaDto> {
    const ambulancia = await this.cambiarEstadoAmbulancia.ejecutar(
      { ambulanciaId: id, estado: dto.estado, motivo: dto.motivo },
      contexto,
    );
    return AmbulanciaRespuestaDto.desde(ambulancia);
  }

  @Get(':id/historial-estados')
  @RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR)
  @ApiOperation({
    summary: 'Historial de cambios de estado, del más reciente al más antiguo',
  })
  @ApiOkResponse({ type: HistorialEstadosRespuestaDto })
  @ApiNotFoundResponse()
  async historialEstados(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() paginacion: PaginacionDto,
  ): Promise<HistorialEstadosRespuestaDto> {
    const resultado = await this.consultarHistorialEstados.ejecutar(id, {
      pagina: paginacion.pagina,
      limite: paginacion.limite,
    });
    return HistorialEstadosRespuestaDto.desde(resultado);
  }
}
