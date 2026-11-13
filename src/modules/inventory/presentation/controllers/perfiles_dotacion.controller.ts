import {
  Body,
  Controller,
  Delete,
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
import { fechaColombia } from '../../../../common/utils/fecha_colombia.js';
import { GestionarPerfilesDotacion } from '../../application/use-cases/gestionar_perfiles_dotacion.use-case.js';
import { CambiarActivoDto } from '../dto/estado.dto.js';
import {
  ActualizarDetallePerfilDto,
  ActualizarPerfilDotacionDto,
  ConsultarPerfilesDotacionDto,
  CrearPerfilDotacionDto,
  DetallePerfilDto,
  PerfilDotacionRespuestaDto,
  PerfilesDotacionPaginadosRespuestaDto,
} from '../dto/perfil_dotacion.dto.js';

function detalle(dto: DetallePerfilDto) {
  return {
    insumoId: dto.insumoId,
    cantidadRequerida: dto.cantidadRequerida,
    cantidadMinima: dto.cantidadMinima ?? null,
    obligatorio: dto.obligatorio ?? true,
    observaciones: dto.observaciones ?? null,
  };
}

/** Dotación exigida por tipo de ambulancia, con versiones. Uno activo por tipo. */
@ApiTags('Inventario: perfiles de dotación')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({ description: 'Solo administradores y despachadores' })
@RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR)
@Controller('inventario/perfiles-dotacion')
export class PerfilesDotacionController {
  constructor(private readonly perfiles: GestionarPerfilesDotacion) {}

  private respuesta(
    perfil: Parameters<typeof PerfilDotacionRespuestaDto.desde>[0],
  ) {
    return PerfilDotacionRespuestaDto.desde(perfil, fechaColombia(new Date()));
  }

  @Post()
  @ApiOperation({ summary: 'Crear la versión 1 de un perfil (nace inactivo)' })
  @ApiCreatedResponse({ type: PerfilDotacionRespuestaDto })
  @ApiNotFoundResponse({
    description: 'Tipo de ambulancia o insumo no encontrado',
  })
  @ApiConflictResponse({
    description: 'El código ya existe para ese tipo: use una versión nueva',
  })
  async crear(
    @Body() dto: CrearPerfilDotacionDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<PerfilDotacionRespuestaDto> {
    return this.respuesta(
      await this.perfiles.crear(
        {
          tipoAmbulanciaId: dto.tipoAmbulanciaId,
          codigo: dto.codigo,
          nombre: dto.nombre,
          descripcion: dto.descripcion ?? null,
          vigenteDesde: dto.vigenteDesde ?? null,
          vigenteHasta: dto.vigenteHasta ?? null,
          detalles: (dto.detalles ?? []).map(detalle),
        },
        contexto,
      ),
    );
  }

  @Get()
  @ApiOperation({ summary: 'Consultar perfiles' })
  @ApiOkResponse({ type: PerfilesDotacionPaginadosRespuestaDto })
  async listar(
    @Query() { pagina, limite, ...filtros }: ConsultarPerfilesDotacionDto,
  ): Promise<PerfilesDotacionPaginadosRespuestaDto> {
    return PerfilesDotacionPaginadosRespuestaDto.desde(
      await this.perfiles.listar(filtros, { pagina, limite }),
      fechaColombia(new Date()),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un perfil con sus elementos' })
  @ApiOkResponse({ type: PerfilDotacionRespuestaDto })
  @ApiNotFoundResponse()
  async obtener(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PerfilDotacionRespuestaDto> {
    return this.respuesta(await this.perfiles.obtener(id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar nombre, descripción o vigencia' })
  @ApiOkResponse({ type: PerfilDotacionRespuestaDto })
  @ApiNotFoundResponse()
  async actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarPerfilDotacionDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<PerfilDotacionRespuestaDto> {
    return this.respuesta(await this.perfiles.actualizar(id, dto, contexto));
  }

  @Patch(':id/estado')
  @ApiOperation({
    summary: 'Activar (desactiva los demás del mismo tipo) o desactivar',
  })
  @ApiOkResponse({ type: PerfilDotacionRespuestaDto })
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse({
    description: 'Sin elementos o con la vigencia vencida',
  })
  async cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarActivoDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<PerfilDotacionRespuestaDto> {
    return this.respuesta(
      await this.perfiles.cambiarEstado(id, dto.activo, contexto),
    );
  }

  @Post(':id/versiones')
  @ApiOperation({
    summary: 'Crear la versión siguiente (copia inactiva y sin vigencia)',
  })
  @ApiCreatedResponse({ type: PerfilDotacionRespuestaDto })
  @ApiNotFoundResponse()
  async nuevaVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<PerfilDotacionRespuestaDto> {
    return this.respuesta(await this.perfiles.nuevaVersion(id, contexto));
  }

  @Post(':id/detalles')
  @ApiOperation({ summary: 'Agregar un insumo al perfil' })
  @ApiCreatedResponse({ type: PerfilDotacionRespuestaDto })
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse({
    description: 'Insumo repetido o inactivo, cantidades inválidas',
  })
  async agregarDetalle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DetallePerfilDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<PerfilDotacionRespuestaDto> {
    return this.respuesta(
      await this.perfiles.agregarDetalle(id, detalle(dto), contexto),
    );
  }

  @Patch(':id/detalles/:detalleId')
  @ApiOperation({
    summary: 'Cambiar cantidades u obligatoriedad de un elemento',
  })
  @ApiOkResponse({ type: PerfilDotacionRespuestaDto })
  @ApiNotFoundResponse()
  async actualizarDetalle(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('detalleId', ParseUUIDPipe) detalleId: string,
    @Body() dto: ActualizarDetallePerfilDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<PerfilDotacionRespuestaDto> {
    return this.respuesta(
      await this.perfiles.actualizarDetalle(id, detalleId, dto, contexto),
    );
  }

  @Delete(':id/detalles/:detalleId')
  @ApiOperation({ summary: 'Quitar un elemento del perfil' })
  @ApiOkResponse({ type: PerfilDotacionRespuestaDto })
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse({
    description: 'Un perfil activo no puede quedar vacío',
  })
  async quitarDetalle(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('detalleId', ParseUUIDPipe) detalleId: string,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<PerfilDotacionRespuestaDto> {
    return this.respuesta(
      await this.perfiles.quitarDetalle(id, detalleId, contexto),
    );
  }
}
