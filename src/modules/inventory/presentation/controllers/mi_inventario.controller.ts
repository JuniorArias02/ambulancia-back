import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
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
import type { Response } from 'express';
import { Roles } from '../../../../common/constants/roles.js';
import { Contexto } from '../../../../common/decorators/contexto.decorator.js';
import { RequiereRoles } from '../../../../common/decorators/requiere_roles.decorator.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { ConsultarMovimientos } from '../../application/use-cases/consultar_movimientos.use-case.js';
import { ConsultarVerificaciones } from '../../application/use-cases/consultar_verificaciones.use-case.js';
import { OperarInventarioAmbulancia } from '../../application/use-cases/operar_inventario_ambulancia.use-case.js';
import { RegistrarControlAlmacenamiento } from '../../application/use-cases/registrar_control_almacenamiento.use-case.js';
import { VerificarInventarioAmbulancia } from '../../application/use-cases/verificar_inventario_ambulancia.use-case.js';
import { BodegaResumenRespuestaDto } from '../dto/bodega.dto.js';
import {
  ControlAlmacenamientoRespuestaDto,
  LecturaAlmacenamientoDto,
} from '../dto/control_almacenamiento.dto.js';
import { MiInventarioRespuestaDto } from '../dto/mi_inventario_respuesta.dto.js';
import {
  MisMovimientosDto,
  MovimientoRespuestaDto,
  MovimientosPaginadosRespuestaDto,
  RegistrarConsumoDto,
  RegistrarDevolucionDto,
} from '../dto/movimiento.dto.js';
import {
  FinalizarVerificacionDto,
  HistorialVerificacionesDto,
  IniciarVerificacionDto,
  RegistrarConteosDto,
  VerificacionAbiertaRespuestaDto,
  VerificacionesInventarioPaginadasRespuestaDto,
  VerificacionIniciadaRespuestaDto,
  VerificacionRespuestaDto,
} from '../dto/verificacion.dto.js';

/**
 * El paramédico opera el inventario de la ambulancia de su turno. La
 * ambulancia sale del token y del turno, nunca de la solicitud.
 */
@ApiTags('Inventario: paramédico')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({ description: 'Solo el paramédico de la ambulancia' })
@ApiUnprocessableEntityResponse({
  description: 'No ha seleccionado ambulancia o su inventario está inactivo',
})
@RequiereRoles(Roles.PARAMEDICO)
@Controller('mi-inventario')
export class MiInventarioController {
  constructor(
    private readonly operar: OperarInventarioAmbulancia,
    private readonly verificar: VerificarInventarioAmbulancia,
    private readonly consultarMovimientos: ConsultarMovimientos,
    private readonly consultarVerificaciones: ConsultarVerificaciones,
    private readonly controles: RegistrarControlAlmacenamiento,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Existencias de mi ambulancia, comparación con su dotación y verificación en curso',
  })
  @ApiOkResponse({ type: MiInventarioRespuestaDto })
  async miInventario(
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<MiInventarioRespuestaDto> {
    return MiInventarioRespuestaDto.desdeMiInventario(
      await this.operar.miInventario(contexto),
    );
  }

  @Post('consumos')
  @ApiOperation({
    summary: 'Registrar lo usado (se confirma de una vez y descuenta)',
  })
  @ApiCreatedResponse({ type: MovimientoRespuestaDto })
  @ApiNotFoundResponse({
    description: 'Insumo, lote, equipo o servicio no encontrado',
  })
  @ApiConflictResponse({ description: 'La ambulancia no tiene esa cantidad' })
  async consumo(
    @Body() dto: RegistrarConsumoDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<MovimientoRespuestaDto> {
    return MovimientoRespuestaDto.desde(
      await this.operar.registrarConsumo(
        {
          lineas: dto.lineas,
          asignacionId: dto.asignacionId ?? null,
          observaciones: dto.observaciones ?? null,
        },
        contexto,
      ),
    );
  }

  @Get('bodegas')
  @ApiOperation({ summary: 'Bodegas activas a las que se puede devolver' })
  @ApiOkResponse({ type: [BodegaResumenRespuestaDto] })
  async bodegasActivas(): Promise<BodegaResumenRespuestaDto[]> {
    return (await this.operar.bodegasDisponibles()).map((b) =>
      BodegaResumenRespuestaDto.desde(b),
    );
  }

  @Post('devoluciones')
  @ApiOperation({
    summary:
      'Devolver a una bodega (queda en borrador hasta que la bodega la confirme)',
  })
  @ApiCreatedResponse({ type: MovimientoRespuestaDto })
  @ApiNotFoundResponse({
    description: 'Bodega, insumo, lote o equipo no encontrado',
  })
  async devolucion(
    @Body() dto: RegistrarDevolucionDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<MovimientoRespuestaDto> {
    return MovimientoRespuestaDto.desde(
      await this.operar.registrarDevolucion(
        {
          bodegaId: dto.bodegaId,
          lineas: dto.lineas,
          motivo: dto.motivo ?? null,
          observaciones: dto.observaciones ?? null,
        },
        contexto,
      ),
    );
  }

  @Get('movimientos')
  @ApiOperation({
    summary: 'Movimientos de mi ambulancia (entradas, consumos, devoluciones…)',
  })
  @ApiOkResponse({ type: MovimientosPaginadosRespuestaDto })
  async movimientos(
    @Query() { pagina, limite, ...filtros }: MisMovimientosDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<MovimientosPaginadosRespuestaDto> {
    const { ubicacion } = await this.operar.paramedico(contexto);
    return MovimientosPaginadosRespuestaDto.desde(
      await this.consultarMovimientos.listar(
        { ...filtros, ubicacionId: ubicacion.id },
        { pagina, limite },
      ),
    );
  }

  @Get('movimientos/:id')
  @ApiOperation({ summary: 'Detalle de un movimiento de mi ambulancia' })
  @ApiOkResponse({ type: MovimientoRespuestaDto })
  @ApiNotFoundResponse({ description: 'No existe o no es de su ambulancia' })
  async movimiento(
    @Param('id', ParseUUIDPipe) id: string,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<MovimientoRespuestaDto> {
    const { ubicacion } = await this.operar.paramedico(contexto);
    return MovimientoRespuestaDto.desde(
      await this.consultarMovimientos.obtener(id, ubicacion.id),
    );
  }

  @Post('controles-almacenamiento')
  @ApiOperation({
    summary: 'Registrar temperatura y/o humedad de mi ambulancia',
  })
  @ApiCreatedResponse({ type: ControlAlmacenamientoRespuestaDto })
  async control(
    @Body() dto: LecturaAlmacenamientoDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<ControlAlmacenamientoRespuestaDto> {
    const { ubicacion } = await this.operar.paramedico(contexto);
    return ControlAlmacenamientoRespuestaDto.desde(
      await this.controles.registrar(
        {
          ubicacionId: ubicacion.id,
          temperatura: dto.temperatura ?? null,
          humedad: dto.humedad ?? null,
          registradoEn: dto.registradoEn ?? null,
          observaciones: dto.observaciones ?? null,
        },
        contexto,
      ),
    );
  }

  @Get('verificacion')
  @ApiOperation({
    summary: 'La verificación en curso de mi ambulancia (o null)',
  })
  @ApiOkResponse({ type: VerificacionAbiertaRespuestaDto })
  async verificacionAbierta(
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<VerificacionAbiertaRespuestaDto> {
    const verificacion = await this.verificar.abierta(contexto);
    return {
      verificacion: verificacion
        ? VerificacionRespuestaDto.desde(verificacion)
        : null,
    };
  }

  @Post('verificacion')
  @ApiOperation({
    summary:
      'Iniciar una verificación (201 si la crea; 200 con la abierta si ya había una)',
  })
  @ApiCreatedResponse({ type: VerificacionIniciadaRespuestaDto })
  @ApiOkResponse({ type: VerificacionIniciadaRespuestaDto })
  async iniciarVerificacion(
    @Body() dto: IniciarVerificacionDto,
    @Contexto() contexto: ContextoSolicitud,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<VerificacionIniciadaRespuestaDto> {
    const { verificacion, creada } = await this.verificar.iniciar(
      { tipo: dto.tipo, observaciones: dto.observaciones ?? null },
      contexto,
    );
    respuesta.status(creada ? HttpStatus.CREATED : HttpStatus.OK);
    return VerificacionIniciadaRespuestaDto.desdeIniciada(verificacion, creada);
  }

  @Put('verificacion/conteos')
  @ApiOperation({
    summary: 'Guardar conteos (contar otra vez la misma unidad la reemplaza)',
  })
  @ApiOkResponse({ type: VerificacionRespuestaDto })
  @ApiNotFoundResponse({
    description:
      'No hay verificación abierta, o insumo/lote/equipo no encontrado',
  })
  @ApiConflictResponse({ description: 'Se finalizó mientras tanto' })
  async registrarConteos(
    @Body() dto: RegistrarConteosDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<VerificacionRespuestaDto> {
    return VerificacionRespuestaDto.desde(
      await this.verificar.registrarConteos(
        dto.conteos.map((c) => ({
          insumoId: c.insumoId,
          loteId: c.loteId ?? null,
          equipoId: c.equipoId ?? null,
          cantidadEncontrada: c.cantidadEncontrada,
          estado: c.estado ?? null,
          observaciones: c.observaciones ?? null,
        })),
        contexto,
      ),
    );
  }

  @Post('verificacion/finalizar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Finalizar: queda "completada" o "con_novedades"' })
  @ApiOkResponse({ type: VerificacionRespuestaDto })
  @ApiNotFoundResponse({ description: 'No hay verificación abierta' })
  @ApiConflictResponse({ description: 'Se finalizó mientras tanto' })
  async finalizarVerificacion(
    @Body() dto: FinalizarVerificacionDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<VerificacionRespuestaDto> {
    return VerificacionRespuestaDto.desde(
      await this.verificar.finalizar(dto.observaciones ?? null, contexto),
    );
  }

  @Get('verificaciones')
  @ApiOperation({ summary: 'Historial de verificaciones de mi ambulancia' })
  @ApiOkResponse({ type: VerificacionesInventarioPaginadasRespuestaDto })
  async verificaciones(
    @Query() { pagina, limite, ...filtros }: HistorialVerificacionesDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<VerificacionesInventarioPaginadasRespuestaDto> {
    const { ubicacion } = await this.operar.paramedico(contexto);
    return VerificacionesInventarioPaginadasRespuestaDto.desde(
      await this.consultarVerificaciones.listar(
        { ...filtros, ubicacionId: ubicacion.id },
        { pagina, limite },
      ),
    );
  }

  @Get('verificaciones/:id')
  @ApiOperation({ summary: 'Detalle de una verificación de mi ambulancia' })
  @ApiOkResponse({ type: VerificacionRespuestaDto })
  @ApiNotFoundResponse({ description: 'No existe o no es de su ambulancia' })
  async verificacion(
    @Param('id', ParseUUIDPipe) id: string,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<VerificacionRespuestaDto> {
    const { ubicacion } = await this.operar.paramedico(contexto);
    return VerificacionRespuestaDto.desde(
      await this.consultarVerificaciones.obtener(id, ubicacion.id),
    );
  }
}
