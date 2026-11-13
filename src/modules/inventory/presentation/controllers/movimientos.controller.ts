import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { fechaColombia } from '../../../../common/utils/fecha_colombia.js';
import { ConsultarAlertasInventario } from '../../application/use-cases/consultar_alertas_inventario.use-case.js';
import { ConsultarExistencias } from '../../application/use-cases/consultar_existencias.use-case.js';
import { ConsultarMovimientos } from '../../application/use-cases/consultar_movimientos.use-case.js';
import { GestionarEstadoMovimiento } from '../../application/use-cases/gestionar_estado_movimiento.use-case.js';
import { RegistrarMovimiento } from '../../application/use-cases/registrar_movimiento.use-case.js';
import {
  AlertasRespuestaDto,
  ConsultarAlertasDto,
  ConsultarExistenciasDto,
  DotacionRespuestaDto,
  ExistenciasPaginadasRespuestaDto,
} from '../dto/existencia.dto.js';
import {
  AnularMovimientoDto,
  ConsultarMovimientosDto,
  MovimientoRespuestaDto,
  MovimientosPaginadosRespuestaDto,
  RegistrarMovimientoDto,
} from '../dto/movimiento.dto.js';

/** Movimientos, existencias, dotación por ambulancia y alertas de la bodega. */
@ApiTags('Inventario: movimientos y existencias')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({ description: 'Solo administradores y despachadores' })
@RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR)
@Controller('inventario')
export class MovimientosController {
  constructor(
    private readonly registrarMovimiento: RegistrarMovimiento,
    private readonly estadoMovimiento: GestionarEstadoMovimiento,
    private readonly consultarMovimientos: ConsultarMovimientos,
    private readonly consultarExistencias: ConsultarExistencias,
    private readonly consultarAlertas: ConsultarAlertasInventario,
  ) {}

  @Post('movimientos')
  @ApiOperation({
    summary:
      'Registrar un movimiento (borrador, o confirmado con confirmar: true)',
  })
  @ApiCreatedResponse({ type: MovimientoRespuestaDto })
  @ApiNotFoundResponse({
    description: 'Ubicación, insumo, lote, equipo o servicio no encontrado',
  })
  @ApiConflictResponse({
    description:
      'Al confirmar: existencia insuficiente o equipo en otra ubicación',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Origen/destino no válidos para el tipo, lote vencido a ambulancia, falta motivo…',
  })
  async registrar(
    @Body() dto: RegistrarMovimientoDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<MovimientoRespuestaDto> {
    return MovimientoRespuestaDto.desde(
      await this.registrarMovimiento.ejecutar(
        {
          tipo: dto.tipo,
          origenUbicacionId: dto.origenUbicacionId,
          destinoUbicacionId: dto.destinoUbicacionId,
          lineas: dto.lineas,
          asignacionId: dto.asignacionId,
          motivo: dto.motivo,
          observaciones: dto.observaciones,
          documentoReferencia: dto.documentoReferencia,
          realizadoEn: dto.realizadoEn,
          confirmar: dto.confirmar ?? false,
        },
        contexto,
      ),
    );
  }

  @Get('movimientos')
  @ApiOperation({ summary: 'Consultar movimientos (más reciente primero)' })
  @ApiOkResponse({ type: MovimientosPaginadosRespuestaDto })
  async listar(
    @Query() { pagina, limite, ...filtros }: ConsultarMovimientosDto,
  ): Promise<MovimientosPaginadosRespuestaDto> {
    return MovimientosPaginadosRespuestaDto.desde(
      await this.consultarMovimientos.listar(filtros, { pagina, limite }),
    );
  }

  @Get('movimientos/:id')
  @ApiOperation({ summary: 'Detalle de un movimiento' })
  @ApiOkResponse({ type: MovimientoRespuestaDto })
  @ApiNotFoundResponse()
  async obtener(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MovimientoRespuestaDto> {
    return MovimientoRespuestaDto.desde(
      await this.consultarMovimientos.obtener(id),
    );
  }

  @Post('movimientos/:id/confirmar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirmar un borrador: aplica las existencias' })
  @ApiOkResponse({ type: MovimientoRespuestaDto })
  @ApiNotFoundResponse()
  @ApiConflictResponse({
    description: 'Ya no está en borrador o la existencia no alcanza',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Ya confirmado/anulado, lote vencido o ubicación inactiva',
  })
  async confirmar(
    @Param('id', ParseUUIDPipe) id: string,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<MovimientoRespuestaDto> {
    return MovimientoRespuestaDto.desde(
      await this.estadoMovimiento.confirmar(id, contexto),
    );
  }

  @Post('movimientos/:id/anular')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Anular un borrador (uno confirmado se corrige con un ajuste)',
  })
  @ApiOkResponse({ type: MovimientoRespuestaDto })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Ya no está en borrador' })
  async anular(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnularMovimientoDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<MovimientoRespuestaDto> {
    return MovimientoRespuestaDto.desde(
      await this.estadoMovimiento.anular(id, dto.motivo, contexto),
    );
  }

  @Get('existencias')
  @ApiOperation({ summary: 'Existencias por ubicación, insumo, lote y equipo' })
  @ApiOkResponse({ type: ExistenciasPaginadasRespuestaDto })
  async existencias(
    @Query() { pagina, limite, ...filtros }: ConsultarExistenciasDto,
  ): Promise<ExistenciasPaginadasRespuestaDto> {
    return ExistenciasPaginadasRespuestaDto.desde(
      await this.consultarExistencias.listar(filtros, { pagina, limite }),
      fechaColombia(new Date()),
    );
  }

  @Get('ambulancias/:ambulanciaId/dotacion')
  @ApiOperation({
    summary:
      'Lo que tiene la ambulancia frente a su perfil de dotación vigente',
  })
  @ApiOkResponse({ type: DotacionRespuestaDto })
  @ApiNotFoundResponse({ description: 'Ambulancia no encontrada' })
  async dotacion(
    @Param('ambulanciaId', ParseUUIDPipe) ambulanciaId: string,
  ): Promise<DotacionRespuestaDto> {
    return DotacionRespuestaDto.desde(
      await this.consultarExistencias.dotacionDeAmbulancia(ambulanciaId),
    );
  }

  @Get('alertas')
  @ApiOperation({
    summary:
      'Lotes por vencer, mantenimientos, registros por vencer y stock bajo',
  })
  @ApiOkResponse({ type: AlertasRespuestaDto })
  async alertas(
    @Query() { dias }: ConsultarAlertasDto,
  ): Promise<AlertasRespuestaDto> {
    return AlertasRespuestaDto.desde(
      await this.consultarAlertas.ejecutar(dias),
    );
  }
}
