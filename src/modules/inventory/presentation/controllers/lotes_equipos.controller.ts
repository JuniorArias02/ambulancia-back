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
import { fechaColombia } from '../../../../common/utils/fecha_colombia.js';
import { GestionarEquipos } from '../../application/use-cases/gestionar_equipos.use-case.js';
import { GestionarLotes } from '../../application/use-cases/gestionar_lotes.use-case.js';
import {
  ActualizarEquipoDto,
  CambiarEstadoEquipoDto,
  ConsultarEquiposDto,
  CrearEquipoDto,
  EquipoRespuestaDto,
  EquiposPaginadosRespuestaDto,
  MantenimientoRegistradoRespuestaDto,
  MantenimientoRespuestaDto,
  RegistrarMantenimientoDto,
} from '../dto/equipo.dto.js';
import {
  ActualizarLoteDto,
  ConsultarLotesDto,
  CrearLoteDto,
  LoteRespuestaDto,
  LotesPaginadosRespuestaDto,
} from '../dto/lote.dto.js';

@ApiTags('Inventario: lotes y equipos')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({ description: 'Solo administradores y despachadores' })
@RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR)
@Controller('inventario')
export class LotesEquiposController {
  constructor(
    private readonly lotes: GestionarLotes,
    private readonly equipos: GestionarEquipos,
  ) {}

  @Post('lotes')
  @ApiOperation({
    summary:
      'Registrar un lote (no mueve existencias: eso lo hace una entrada)',
  })
  @ApiCreatedResponse({ type: LoteRespuestaDto })
  @ApiNotFoundResponse({
    description: 'Insumo o registro sanitario no encontrado',
  })
  @ApiConflictResponse({ description: 'Lote repetido para el insumo' })
  @ApiUnprocessableEntityResponse({
    description:
      'Insumo no va por lote, falta vencimiento o registro sanitario vigente',
  })
  async crearLote(
    @Body() dto: CrearLoteDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<LoteRespuestaDto> {
    const lote = await this.lotes.crear(
      {
        insumoId: dto.insumoId,
        registroSanitarioId: dto.registroSanitarioId ?? null,
        numeroLote: dto.numeroLote,
        recibidoEn: dto.recibidoEn ?? null,
        fechaFabricacion: dto.fechaFabricacion ?? null,
        fechaVencimiento: dto.fechaVencimiento ?? null,
        fabricante: dto.fabricante ?? null,
        proveedor: dto.proveedor ?? null,
        documentoSoporte: dto.documentoSoporte ?? null,
        observaciones: dto.observaciones ?? null,
      },
      contexto,
    );
    return LoteRespuestaDto.desde(lote, fechaColombia(new Date()));
  }

  @Get('lotes')
  @RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR, Roles.PARAMEDICO)
  @ApiOperation({
    summary: 'Consultar lotes (también el paramédico, solo lectura)',
  })
  @ApiOkResponse({ type: LotesPaginadosRespuestaDto })
  async listarLotes(
    @Query() { pagina, limite, ...filtros }: ConsultarLotesDto,
  ): Promise<LotesPaginadosRespuestaDto> {
    return LotesPaginadosRespuestaDto.desde(
      await this.lotes.listar(filtros, { pagina, limite }),
      fechaColombia(new Date()),
    );
  }

  @Get('lotes/:id')
  @ApiOperation({ summary: 'Obtener un lote' })
  @ApiOkResponse({ type: LoteRespuestaDto })
  @ApiNotFoundResponse()
  async obtenerLote(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LoteRespuestaDto> {
    return LoteRespuestaDto.desde(
      await this.lotes.obtener(id),
      fechaColombia(new Date()),
    );
  }

  @Patch('lotes/:id')
  @ApiOperation({
    summary: 'Corregir fechas, proveedor u observaciones de un lote',
  })
  @ApiOkResponse({ type: LoteRespuestaDto })
  @ApiNotFoundResponse()
  async actualizarLote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarLoteDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<LoteRespuestaDto> {
    return LoteRespuestaDto.desde(
      await this.lotes.actualizar(id, dto, contexto),
      fechaColombia(new Date()),
    );
  }

  @Post('equipos')
  @ApiOperation({ summary: 'Registrar un equipo por número de serie' })
  @ApiCreatedResponse({ type: EquipoRespuestaDto })
  @ApiNotFoundResponse({
    description: 'Insumo o registro sanitario no encontrado',
  })
  @ApiConflictResponse({ description: 'Serie repetida' })
  async crearEquipo(
    @Body() dto: CrearEquipoDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<EquipoRespuestaDto> {
    return EquipoRespuestaDto.desde(
      await this.equipos.crear(
        {
          insumoId: dto.insumoId,
          registroSanitarioId: dto.registroSanitarioId ?? null,
          numeroSerie: dto.numeroSerie,
          marca: dto.marca ?? null,
          modelo: dto.modelo ?? null,
          fechaAdquisicion: dto.fechaAdquisicion ?? null,
          fechaProximoMantenimiento: dto.fechaProximoMantenimiento ?? null,
          observaciones: dto.observaciones ?? null,
        },
        contexto,
      ),
    );
  }

  @Get('equipos')
  @ApiOperation({ summary: 'Consultar equipos' })
  @ApiOkResponse({ type: EquiposPaginadosRespuestaDto })
  async listarEquipos(
    @Query() { pagina, limite, ...filtros }: ConsultarEquiposDto,
  ): Promise<EquiposPaginadosRespuestaDto> {
    return EquiposPaginadosRespuestaDto.desde(
      await this.equipos.listar(filtros, { pagina, limite }),
    );
  }

  @Get('equipos/:id')
  @ApiOperation({ summary: 'Obtener un equipo' })
  @ApiOkResponse({ type: EquipoRespuestaDto })
  @ApiNotFoundResponse()
  async obtenerEquipo(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EquipoRespuestaDto> {
    return EquipoRespuestaDto.desde(await this.equipos.obtener(id));
  }

  @Patch('equipos/:id')
  @ApiOperation({ summary: 'Editar datos de un equipo' })
  @ApiOkResponse({ type: EquipoRespuestaDto })
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse({ description: 'Dado de baja' })
  async actualizarEquipo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarEquipoDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<EquipoRespuestaDto> {
    return EquipoRespuestaDto.desde(
      await this.equipos.actualizar(id, dto, contexto),
    );
  }

  @Patch('equipos/:id/estado')
  @ApiOperation({
    summary:
      'Cambiar el estado (operativo, mantenimiento, fuera_servicio, baja)',
  })
  @ApiOkResponse({ type: EquipoRespuestaDto })
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse({ description: 'Ya estaba dado de baja' })
  async cambiarEstadoEquipo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoEquipoDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<EquipoRespuestaDto> {
    return EquipoRespuestaDto.desde(
      await this.equipos.cambiarEstado(
        id,
        dto.estado,
        dto.motivo ?? null,
        contexto,
      ),
    );
  }

  @Post('equipos/:id/mantenimientos')
  @ApiOperation({ summary: 'Registrar un mantenimiento o calibración' })
  @ApiCreatedResponse({ type: MantenimientoRegistradoRespuestaDto })
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse({
    description: 'Fechas inválidas o equipo dado de baja',
  })
  async registrarMantenimiento(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegistrarMantenimientoDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<MantenimientoRegistradoRespuestaDto> {
    const { equipo, mantenimiento } = await this.equipos.registrarMantenimiento(
      id,
      {
        tipo: dto.tipo,
        fechaMantenimiento: dto.fechaMantenimiento,
        fechaProximo: dto.fechaProximo ?? null,
        responsable: dto.responsable ?? null,
        proveedor: dto.proveedor ?? null,
        documentoSoporte: dto.documentoSoporte ?? null,
        resultado: dto.resultado ?? null,
        observaciones: dto.observaciones ?? null,
      },
      contexto,
    );
    return {
      equipo: EquipoRespuestaDto.desde(equipo),
      mantenimiento: MantenimientoRespuestaDto.desde(mantenimiento),
    };
  }

  @Get('equipos/:id/mantenimientos')
  @ApiOperation({
    summary: 'Historial de mantenimientos (más reciente primero)',
  })
  @ApiOkResponse({ type: [MantenimientoRespuestaDto] })
  @ApiNotFoundResponse()
  async listarMantenimientos(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MantenimientoRespuestaDto[]> {
    return (await this.equipos.listarMantenimientos(id)).map((m) =>
      MantenimientoRespuestaDto.desde(m),
    );
  }
}
