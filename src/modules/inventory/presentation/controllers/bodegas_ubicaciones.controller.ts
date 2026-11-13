import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { GestionarBodegas } from '../../application/use-cases/gestionar_bodegas.use-case.js';
import { GestionarUbicaciones } from '../../application/use-cases/gestionar_ubicaciones.use-case.js';
import {
  ActualizarBodegaDto,
  BodegaRespuestaDto,
  BodegasPaginadasRespuestaDto,
  ConsultarBodegasDto,
  CrearBodegaDto,
} from '../dto/bodega.dto.js';
import { CambiarActivoDto } from '../dto/estado.dto.js';
import {
  CambiarEstadoUbicacionDto,
  ConsultarUbicacionesDto,
  HabilitarAmbulanciaDto,
  UbicacionInventarioRespuestaDto,
} from '../dto/ubicacion.dto.js';

/** Bodegas y ubicaciones (bodega o ambulancia) donde vive el inventario. */
@ApiTags('Inventario: bodegas y ubicaciones')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({ description: 'Solo administradores y despachadores' })
@RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR)
@Controller('inventario')
export class BodegasUbicacionesController {
  constructor(
    private readonly bodegas: GestionarBodegas,
    private readonly ubicaciones: GestionarUbicaciones,
  ) {}

  @Post('bodegas')
  @ApiOperation({
    summary: 'Crear una bodega (crea también su ubicación de inventario)',
  })
  @ApiCreatedResponse({ type: BodegaRespuestaDto })
  @ApiConflictResponse({ description: 'Código repetido' })
  @ApiUnprocessableEntityResponse({
    description: 'Responsable que no es personal interno activo',
  })
  async crearBodega(
    @Body() dto: CrearBodegaDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<BodegaRespuestaDto> {
    return BodegaRespuestaDto.desde(
      await this.bodegas.crear(
        {
          codigo: dto.codigo,
          nombre: dto.nombre,
          ubicacion: dto.ubicacion ?? null,
          responsableId: dto.responsableId ?? null,
        },
        contexto,
      ),
    );
  }

  @Get('bodegas')
  @ApiOperation({ summary: 'Consultar bodegas' })
  @ApiOkResponse({ type: BodegasPaginadasRespuestaDto })
  async listarBodegas(
    @Query() { pagina, limite, ...filtros }: ConsultarBodegasDto,
  ): Promise<BodegasPaginadasRespuestaDto> {
    return BodegasPaginadasRespuestaDto.desde(
      await this.bodegas.listar(filtros, { pagina, limite }),
    );
  }

  @Get('bodegas/:id')
  @ApiOperation({ summary: 'Obtener una bodega' })
  @ApiOkResponse({ type: BodegaRespuestaDto })
  @ApiNotFoundResponse()
  async obtenerBodega(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BodegaRespuestaDto> {
    return BodegaRespuestaDto.desde(await this.bodegas.obtener(id));
  }

  @Patch('bodegas/:id')
  @ApiOperation({ summary: 'Editar una bodega' })
  @ApiOkResponse({ type: BodegaRespuestaDto })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Código repetido' })
  async actualizarBodega(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarBodegaDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<BodegaRespuestaDto> {
    return BodegaRespuestaDto.desde(
      await this.bodegas.actualizar(id, dto, contexto),
    );
  }

  @Patch('bodegas/:id/estado')
  @ApiOperation({ summary: 'Activar o desactivar una bodega (y su ubicación)' })
  @ApiOkResponse({ type: BodegaRespuestaDto })
  @ApiNotFoundResponse()
  async cambiarEstadoBodega(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarActivoDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<BodegaRespuestaDto> {
    return BodegaRespuestaDto.desde(
      await this.bodegas.cambiarEstado(id, dto.activo, contexto),
    );
  }

  @Get('ubicaciones')
  @ApiOperation({
    summary: 'Ubicaciones de inventario (para elegir origen y destino)',
  })
  @ApiOkResponse({ type: [UbicacionInventarioRespuestaDto] })
  async listarUbicaciones(
    @Query() filtros: ConsultarUbicacionesDto,
  ): Promise<UbicacionInventarioRespuestaDto[]> {
    return (await this.ubicaciones.listar(filtros)).map((u) =>
      UbicacionInventarioRespuestaDto.desde(u),
    );
  }

  @Get('ubicaciones/:id')
  @ApiOperation({ summary: 'Obtener una ubicación' })
  @ApiOkResponse({ type: UbicacionInventarioRespuestaDto })
  @ApiNotFoundResponse()
  async obtenerUbicacion(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UbicacionInventarioRespuestaDto> {
    return UbicacionInventarioRespuestaDto.desde(
      await this.ubicaciones.obtener(id),
    );
  }

  @Post('ubicaciones/ambulancias')
  @ApiOperation({
    summary:
      'Habilitar una ambulancia en el inventario (201 si la crea, 200 si ya existía)',
  })
  @ApiCreatedResponse({ type: UbicacionInventarioRespuestaDto })
  @ApiOkResponse({ type: UbicacionInventarioRespuestaDto })
  @ApiNotFoundResponse({ description: 'Ambulancia no encontrada' })
  async habilitarAmbulancia(
    @Body() dto: HabilitarAmbulanciaDto,
    @Contexto() contexto: ContextoSolicitud,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<UbicacionInventarioRespuestaDto> {
    const { ubicacion, creada } = await this.ubicaciones.habilitarAmbulancia(
      dto.ambulanciaId,
      contexto,
    );
    respuesta.status(creada ? HttpStatus.CREATED : HttpStatus.OK);
    return UbicacionInventarioRespuestaDto.desde(ubicacion);
  }

  @Patch('ubicaciones/:id/estado')
  @ApiOperation({
    summary: 'Activar o desactivar la ubicación de una ambulancia',
  })
  @ApiOkResponse({ type: UbicacionInventarioRespuestaDto })
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse({
    description: 'Es de una bodega: cambie el estado de la bodega',
  })
  async cambiarEstadoUbicacion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoUbicacionDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<UbicacionInventarioRespuestaDto> {
    return UbicacionInventarioRespuestaDto.desde(
      await this.ubicaciones.cambiarEstado(id, dto.activa, contexto),
    );
  }
}
