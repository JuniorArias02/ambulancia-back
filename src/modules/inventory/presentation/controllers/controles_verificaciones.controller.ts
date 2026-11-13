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
import { ConsultarVerificaciones } from '../../application/use-cases/consultar_verificaciones.use-case.js';
import { RegistrarControlAlmacenamiento } from '../../application/use-cases/registrar_control_almacenamiento.use-case.js';
import { RevisarVerificacion } from '../../application/use-cases/revisar_verificacion.use-case.js';
import {
  ConsultarControlesAlmacenamientoDto,
  ControlAlmacenamientoRespuestaDto,
  ControlesAlmacenamientoPaginadosRespuestaDto,
  RegistrarControlAlmacenamientoDto,
} from '../dto/control_almacenamiento.dto.js';
import {
  ConsultarVerificacionesInventarioDto,
  RevisarVerificacionDto,
  VerificacionesInventarioPaginadasRespuestaDto,
  VerificacionRespuestaDto,
} from '../dto/verificacion.dto.js';

/** Temperatura y humedad de cualquier ubicación, y verificaciones hechas por los paramédicos. */
@ApiTags('Inventario: controles y verificaciones')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({ description: 'Solo administradores y despachadores' })
@RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR)
@Controller('inventario')
export class ControlesVerificacionesController {
  constructor(
    private readonly controles: RegistrarControlAlmacenamiento,
    private readonly verificaciones: ConsultarVerificaciones,
    private readonly revisarVerificacion: RevisarVerificacion,
  ) {}

  @Post('controles-almacenamiento')
  @ApiOperation({
    summary: 'Registrar temperatura y/o humedad de una ubicación',
  })
  @ApiCreatedResponse({ type: ControlAlmacenamientoRespuestaDto })
  @ApiNotFoundResponse({ description: 'Ubicación no encontrada' })
  @ApiUnprocessableEntityResponse({
    description: 'Sin lecturas, fuera de rango o ubicación inactiva',
  })
  async registrarControl(
    @Body() dto: RegistrarControlAlmacenamientoDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<ControlAlmacenamientoRespuestaDto> {
    return ControlAlmacenamientoRespuestaDto.desde(
      await this.controles.registrar(
        {
          ubicacionId: dto.ubicacionId,
          temperatura: dto.temperatura ?? null,
          humedad: dto.humedad ?? null,
          registradoEn: dto.registradoEn ?? null,
          observaciones: dto.observaciones ?? null,
        },
        contexto,
      ),
    );
  }

  @Get('controles-almacenamiento')
  @ApiOperation({ summary: 'Historial de lecturas' })
  @ApiOkResponse({ type: ControlesAlmacenamientoPaginadosRespuestaDto })
  async listarControles(
    @Query()
    { pagina, limite, ...filtros }: ConsultarControlesAlmacenamientoDto,
  ): Promise<ControlesAlmacenamientoPaginadosRespuestaDto> {
    return ControlesAlmacenamientoPaginadosRespuestaDto.desde(
      await this.controles.listar(filtros, { pagina, limite }),
    );
  }

  @Get('verificaciones')
  @ApiOperation({
    summary:
      'Verificaciones de inventario (filtre estado=con_novedades para lo pendiente)',
  })
  @ApiOkResponse({ type: VerificacionesInventarioPaginadasRespuestaDto })
  async listarVerificaciones(
    @Query()
    { pagina, limite, ...filtros }: ConsultarVerificacionesInventarioDto,
  ): Promise<VerificacionesInventarioPaginadasRespuestaDto> {
    return VerificacionesInventarioPaginadasRespuestaDto.desde(
      await this.verificaciones.listar(filtros, { pagina, limite }),
    );
  }

  @Get('verificaciones/:id')
  @ApiOperation({ summary: 'Detalle de una verificación con sus conteos' })
  @ApiOkResponse({ type: VerificacionRespuestaDto })
  @ApiNotFoundResponse()
  async obtenerVerificacion(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VerificacionRespuestaDto> {
    return VerificacionRespuestaDto.desde(
      await this.verificaciones.obtener(id),
    );
  }

  @Post('verificaciones/:id/revision')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Marcar como atendidas las novedades de una verificación',
    description:
      'Deja constancia de quién, cuándo y cómo se resolvieron (ajuste, baja, reposición). No cambia existencias: la corrección se hace antes con sus movimientos. Una sola vez.',
  })
  @ApiOkResponse({ type: VerificacionRespuestaDto })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Ya fue revisada' })
  @ApiUnprocessableEntityResponse({
    description: 'No está finalizada con novedades (borrador o completada)',
  })
  async revisar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevisarVerificacionDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<VerificacionRespuestaDto> {
    return VerificacionRespuestaDto.desde(
      await this.revisarVerificacion.ejecutar(id, dto.resolucion, contexto),
    );
  }
}
