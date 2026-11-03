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
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Roles } from '../../../../common/constants/roles.js';
import { Contexto } from '../../../../common/decorators/contexto.decorator.js';
import { RequiereRoles } from '../../../../common/decorators/requiere_roles.decorator.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { ConsultarVerificaciones } from '../../application/use-cases/consultar_verificaciones.use-case.js';
import { DecidirVerificacion } from '../../application/use-cases/decidir_verificacion.use-case.js';
import { ObtenerDocumentoIdentidad } from '../../application/use-cases/obtener_documento_identidad.use-case.js';
import { ObtenerVerificacion } from '../../application/use-cases/obtener_verificacion.use-case.js';
import { ConsultarVerificacionesDto } from '../dto/consultar_verificaciones.dto.js';
import { DecidirVerificacionDto } from '../dto/decidir_verificacion.dto.js';
import {
  VerificacionDetalleRespuestaDto,
  VerificacionesPaginadasRespuestaDto,
} from '../dto/verificacion_respuesta.dto.js';

const EXTENSIONES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

/** Solo el administrador revisa identidades; conductor, paramédico y ciudadano reciben 403. */
@ApiTags('Verificación de ciudadanos')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({ description: 'Solo administradores' })
@RequiereRoles(Roles.ADMINISTRADOR)
@Controller('verificaciones-ciudadanos')
export class VerificacionesCiudadanosController {
  constructor(
    private readonly consultarVerificaciones: ConsultarVerificaciones,
    private readonly obtenerVerificacion: ObtenerVerificacion,
    private readonly obtenerDocumento: ObtenerDocumentoIdentidad,
    private readonly decidirVerificacion: DecidirVerificacion,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Solicitudes de verificación, de la que más lleva esperando',
  })
  @ApiOkResponse({ type: VerificacionesPaginadasRespuestaDto })
  async consultar(
    @Query() { pagina, limite, ...filtros }: ConsultarVerificacionesDto,
  ): Promise<VerificacionesPaginadasRespuestaDto> {
    return VerificacionesPaginadasRespuestaDto.desde(
      await this.consultarVerificaciones.ejecutar(filtros, { pagina, limite }),
    );
  }

  @Get(':usuarioId')
  @ApiOperation({
    summary:
      'Datos, documentos e historial de una verificación (consulta auditada)',
  })
  @ApiOkResponse({ type: VerificacionDetalleRespuestaDto })
  @ApiNotFoundResponse({ description: 'No es un ciudadano registrado' })
  async obtener(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<VerificacionDetalleRespuestaDto> {
    return VerificacionDetalleRespuestaDto.desdeDetalle(
      await this.obtenerVerificacion.ejecutar(usuarioId, contexto),
    );
  }

  @Get(':usuarioId/documentos/:documentoId')
  @ApiOperation({
    summary: 'Descargar una foto del documento (consulta auditada, sin caché)',
  })
  @ApiProduces('image/jpeg', 'image/png')
  @ApiOkResponse({ description: 'La imagen' })
  @ApiNotFoundResponse({
    description: 'No existe o no pertenece a ese ciudadano',
  })
  async documento(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @Param('documentoId', ParseUUIDPipe) documentoId: string,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<StreamableFile> {
    const { documento, contenido } = await this.obtenerDocumento.ejecutar(
      usuarioId,
      documentoId,
      contexto,
    );
    return new StreamableFile(contenido, {
      type: documento.tipoMime,
      disposition: `inline; filename="documento-${documento.lado}.${EXTENSIONES[documento.tipoMime] ?? 'img'}"`,
      length: contenido.byteLength,
    });
  }

  @Post(':usuarioId/decision')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Tomar, aprobar, rechazar o pedir corrección',
    description:
      'pendiente → en_revision, verificado, rechazado o requiere_correccion; en_revision → verificado, rechazado o requiere_correccion. verificado y rechazado son finales.',
  })
  @ApiOkResponse({ type: VerificacionDetalleRespuestaDto })
  @ApiNotFoundResponse({ description: 'No es un ciudadano registrado' })
  @ApiConflictResponse({ description: 'Otro administrador decidió antes' })
  @ApiUnprocessableEntityResponse({
    description: 'Transición no permitida o falta el motivo',
  })
  async decidir(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @Body() dto: DecidirVerificacionDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<VerificacionDetalleRespuestaDto> {
    return VerificacionDetalleRespuestaDto.desdeDetalle(
      await this.decidirVerificacion.ejecutar(
        {
          usuarioId,
          decision: dto.decision,
          motivo: dto.motivo,
          observaciones: dto.observaciones,
        },
        contexto,
      ),
    );
  }
}
