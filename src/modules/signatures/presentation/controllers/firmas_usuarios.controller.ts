import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
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
import { ConsultarFirmasUsuario } from '../../application/use-cases/consultar_firmas_usuario.use-case.js';
import { DesactivarFirma } from '../../application/use-cases/desactivar_firma.use-case.js';
import { ObtenerImagenFirma } from '../../application/use-cases/obtener_imagen_firma.use-case.js';
import {
  DesactivarFirmaDto,
  FirmaUsuarioRespuestaDto,
} from '../dto/firma_usuario.dto.js';
import { respuestaImagenFirma } from './imagen_firma_respuesta.js';

/**
 * El administrador consulta y desactiva las firmas de los usuarios. No puede
 * registrar ni cambiar la firma de otro: eso solo lo hace el dueño.
 */
@ApiTags('Firmas')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({ description: 'Solo el administrador' })
@RequiereRoles(Roles.ADMINISTRADOR)
@Controller('usuarios/:usuarioId/firmas')
export class FirmasUsuariosController {
  constructor(
    private readonly consultar: ConsultarFirmasUsuario,
    private readonly obtenerImagen: ObtenerImagenFirma,
    private readonly desactivarFirma: DesactivarFirma,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Historial de firmas del usuario (la vigente y las anteriores)',
  })
  @ApiOkResponse({ type: [FirmaUsuarioRespuestaDto] })
  @ApiNotFoundResponse({ description: 'El usuario no existe' })
  async listar(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
  ): Promise<FirmaUsuarioRespuestaDto[]> {
    const firmas = await this.consultar.ejecutar(usuarioId);
    return firmas.map((f) => FirmaUsuarioRespuestaDto.desde(f));
  }

  @Get(':firmaId/imagen')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Imagen de una firma, en PNG (consulta auditada)' })
  @ApiProduces('image/png')
  @ApiOkResponse({ description: 'La imagen' })
  @ApiNotFoundResponse({ description: 'No existe o no es de ese usuario' })
  async imagen(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @Param('firmaId', ParseUUIDPipe) firmaId: string,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<StreamableFile> {
    const { contenido } = await this.obtenerImagen.deUsuario(
      usuarioId,
      firmaId,
      contexto,
    );
    return respuestaImagenFirma(contenido);
  }

  @Post(':firmaId/desactivar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Desactivar la firma vigente (las historias ya firmadas no cambian)',
  })
  @ApiOkResponse({ type: FirmaUsuarioRespuestaDto })
  @ApiNotFoundResponse({ description: 'No existe o no es de ese usuario' })
  @ApiConflictResponse({ description: 'Cambió mientras tanto' })
  @ApiUnprocessableEntityResponse({ description: 'Ya no estaba vigente' })
  async desactivar(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @Param('firmaId', ParseUUIDPipe) firmaId: string,
    @Body() dto: DesactivarFirmaDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<FirmaUsuarioRespuestaDto> {
    return FirmaUsuarioRespuestaDto.desde(
      await this.desactivarFirma.ejecutar(
        usuarioId,
        firmaId,
        dto.motivo,
        contexto,
      ),
    );
  }
}
