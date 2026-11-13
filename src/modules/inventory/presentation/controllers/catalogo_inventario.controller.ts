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
import { GestionarInsumos } from '../../application/use-cases/gestionar_insumos.use-case.js';
import { GestionarRegistrosSanitarios } from '../../application/use-cases/gestionar_registros_sanitarios.use-case.js';
import { CambiarActivoDto } from '../dto/estado.dto.js';
import {
  ActualizarInsumoDto,
  ConsultarInsumosDto,
  CrearInsumoDto,
} from '../dto/insumo.dto.js';
import {
  InsumoRespuestaDto,
  InsumosPaginadosRespuestaDto,
} from '../dto/insumo_respuesta.dto.js';
import {
  ActualizarRegistroSanitarioDto,
  ConsultarRegistrosSanitariosDto,
  CrearRegistroSanitarioDto,
  RegistroSanitarioRespuestaDto,
  RegistrosSanitariosPaginadosRespuestaDto,
} from '../dto/registro_sanitario.dto.js';

/** Catálogo de insumos y sus registros sanitarios. Nada se borra: se desactiva. */
@ApiTags('Inventario: catálogo')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({ description: 'Solo administradores y despachadores' })
@RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR)
@Controller('inventario')
export class CatalogoInventarioController {
  constructor(
    private readonly insumos: GestionarInsumos,
    private readonly registros: GestionarRegistrosSanitarios,
  ) {}

  @Post('insumos')
  @ApiOperation({ summary: 'Crear un insumo del catálogo' })
  @ApiCreatedResponse({ type: InsumoRespuestaDto })
  @ApiConflictResponse({ description: 'Código repetido' })
  @ApiUnprocessableEntityResponse({
    description:
      'Combinación de controles inválida (serie + lote, vencimiento sin lote)',
  })
  async crearInsumo(
    @Body() dto: CrearInsumoDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<InsumoRespuestaDto> {
    return InsumoRespuestaDto.desde(
      await this.insumos.crear(
        {
          codigo: dto.codigo,
          nombre: dto.nombre,
          descripcion: dto.descripcion ?? null,
          tipo: dto.tipo,
          categoria: dto.categoria ?? null,
          unidadMedida: dto.unidadMedida,
          marca: dto.marca ?? null,
          fabricante: dto.fabricante ?? null,
          requiereLote: dto.requiereLote ?? true,
          requiereVencimiento: dto.requiereVencimiento ?? false,
          requiereRegistroSanitario: dto.requiereRegistroSanitario ?? false,
          requiereSerie: dto.requiereSerie ?? false,
          esControlEspecial: dto.esControlEspecial ?? false,
          stockMinimo: dto.stockMinimo ?? 0,
        },
        contexto,
      ),
    );
  }

  @Get('insumos')
  @RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR, Roles.PARAMEDICO)
  @ApiOperation({
    summary: 'Consultar el catálogo (también el paramédico, solo lectura)',
  })
  @ApiOkResponse({ type: InsumosPaginadosRespuestaDto })
  async listarInsumos(
    @Query() { pagina, limite, ...filtros }: ConsultarInsumosDto,
  ): Promise<InsumosPaginadosRespuestaDto> {
    return InsumosPaginadosRespuestaDto.desde(
      await this.insumos.listar(filtros, { pagina, limite }),
    );
  }

  @Get('insumos/:id')
  @ApiOperation({ summary: 'Obtener un insumo' })
  @ApiOkResponse({ type: InsumoRespuestaDto })
  @ApiNotFoundResponse()
  async obtenerInsumo(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InsumoRespuestaDto> {
    return InsumoRespuestaDto.desde(await this.insumos.obtener(id));
  }

  @Patch('insumos/:id')
  @ApiOperation({ summary: 'Editar un insumo (lo que no se envía no cambia)' })
  @ApiOkResponse({ type: InsumoRespuestaDto })
  @ApiNotFoundResponse()
  @ApiConflictResponse({
    description: 'Código repetido, o cambio de lote/serie con historial',
  })
  async actualizarInsumo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarInsumoDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<InsumoRespuestaDto> {
    return InsumoRespuestaDto.desde(
      await this.insumos.actualizar(id, dto, contexto),
    );
  }

  @Patch('insumos/:id/estado')
  @ApiOperation({ summary: 'Activar o desactivar un insumo' })
  @ApiOkResponse({ type: InsumoRespuestaDto })
  @ApiNotFoundResponse()
  async cambiarEstadoInsumo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarActivoDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<InsumoRespuestaDto> {
    return InsumoRespuestaDto.desde(
      await this.insumos.cambiarEstado(id, dto.activo, contexto),
    );
  }

  @Post('registros-sanitarios')
  @ApiOperation({ summary: 'Registrar el registro sanitario de un insumo' })
  @ApiCreatedResponse({ type: RegistroSanitarioRespuestaDto })
  @ApiNotFoundResponse({ description: 'Insumo no encontrado' })
  @ApiConflictResponse({ description: 'Número repetido para el insumo' })
  async crearRegistro(
    @Body() { insumoId, ...dto }: CrearRegistroSanitarioDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<RegistroSanitarioRespuestaDto> {
    const registro = await this.registros.crear(
      insumoId,
      {
        numeroRegistro: dto.numeroRegistro,
        tipoRegistro: dto.tipoRegistro,
        fechaExpedicion: dto.fechaExpedicion ?? null,
        fechaVencimiento: dto.fechaVencimiento ?? null,
        titular: dto.titular ?? null,
        documentoUrl: dto.documentoUrl ?? null,
        estado: dto.estado ?? 'vigente',
      },
      contexto,
    );
    return RegistroSanitarioRespuestaDto.desde(
      registro,
      fechaColombia(new Date()),
    );
  }

  @Get('registros-sanitarios')
  @ApiOperation({ summary: 'Consultar registros sanitarios' })
  @ApiOkResponse({ type: RegistrosSanitariosPaginadosRespuestaDto })
  async listarRegistros(
    @Query() { pagina, limite, ...filtros }: ConsultarRegistrosSanitariosDto,
  ): Promise<RegistrosSanitariosPaginadosRespuestaDto> {
    return RegistrosSanitariosPaginadosRespuestaDto.desde(
      await this.registros.listar(filtros, { pagina, limite }),
      fechaColombia(new Date()),
    );
  }

  @Get('registros-sanitarios/:id')
  @ApiOperation({ summary: 'Obtener un registro sanitario' })
  @ApiOkResponse({ type: RegistroSanitarioRespuestaDto })
  @ApiNotFoundResponse()
  async obtenerRegistro(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RegistroSanitarioRespuestaDto> {
    return RegistroSanitarioRespuestaDto.desde(
      await this.registros.obtener(id),
      fechaColombia(new Date()),
    );
  }

  @Patch('registros-sanitarios/:id')
  @ApiOperation({ summary: 'Editar un registro sanitario (incluye su estado)' })
  @ApiOkResponse({ type: RegistroSanitarioRespuestaDto })
  @ApiNotFoundResponse()
  async actualizarRegistro(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarRegistroSanitarioDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<RegistroSanitarioRespuestaDto> {
    return RegistroSanitarioRespuestaDto.desde(
      await this.registros.actualizar(id, dto, contexto),
      fechaColombia(new Date()),
    );
  }
}
