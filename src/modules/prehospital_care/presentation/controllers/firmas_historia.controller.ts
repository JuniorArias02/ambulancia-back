import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Roles } from '../../../../common/constants/roles.js';
import { Contexto } from '../../../../common/decorators/contexto.decorator.js';
import { RequiereRoles } from '../../../../common/decorators/requiere_roles.decorator.js';
import { UsuarioActual } from '../../../../common/decorators/usuario_actual.decorator.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import type { UsuarioAutenticado } from '../../../../common/types/usuario_autenticado.js';
import {
  type ArchivoFirmaRecibido,
  limitesSubidaFirma,
  respuestaImagenFirma,
} from '../../../signatures/presentation/controllers/imagen_firma_respuesta.js';
import { ObtenerImagenFirmaHistoria } from '../../application/use-cases/obtener_imagen_firma_historia.use-case.js';
import { QuitarFirmaHistoria } from '../../application/use-cases/quitar_firma_historia.use-case.js';
import { RegistrarFirmaHistoria } from '../../application/use-cases/registrar_firma_historia.use-case.js';
import {
  FirmaHistoriaRespuestaDto,
  RegistrarFirmaHistoriaDto,
  RegistrarFirmaHistoriaFormularioDto,
} from '../dto/firma_historia.dto.js';

/**
 * Firmas de la historia de quienes no son usuarios: paciente, acudiente
 * (familiar mayor de edad), testigo y receptor. Las toma el paramédico en el
 * celular; qué firmas se exigen al cerrar depende de la modalidad del servicio.
 */
@ApiTags('Historia clínica')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({
  description: 'No es el paramédico de ese servicio (o el administrador)',
})
@Controller('historias-clinicas/:id/firmas')
export class FirmasHistoriaController {
  constructor(
    private readonly registrar: RegistrarFirmaHistoria,
    private readonly obtenerImagen: ObtenerImagenFirmaHistoria,
    private readonly quitar: QuitarFirmaHistoria,
  ) {}

  @Post()
  @RequiereRoles(Roles.PARAMEDICO)
  // 11 campos de texto posibles (RegistrarFirmaHistoriaDto), con margen.
  @UseInterceptors(FileInterceptor('imagen', limitesSubidaFirma(15)))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: RegistrarFirmaHistoriaFormularioDto })
  @ApiOperation({
    summary:
      'Tomar la firma del paciente, un familiar, un testigo o quien recibe (o registrar por qué no firmó). Reenviar el mismo id no duplica',
  })
  @ApiCreatedResponse({ type: FirmaHistoriaRespuestaDto })
  @ApiConflictResponse({
    description: 'Ya hay una firma de ese firmante para ese propósito',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Historia cerrada, datos del firmante incompletos, menor de edad, propósito que no corresponde o imagen inválida',
  })
  @ApiPayloadTooLargeResponse({ description: 'La imagen supera 200 KB' })
  async registrarFirma(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegistrarFirmaHistoriaDto,
    @UploadedFile() archivo: ArchivoFirmaRecibido | undefined,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<FirmaHistoriaRespuestaDto> {
    if (archivo && dto.motivoSinFirma) {
      throw new BadRequestException(
        'Envíe la imagen o el motivo sin firma, no ambos',
      );
    }
    return FirmaHistoriaRespuestaDto.desde(
      await this.registrar.ejecutar(
        id,
        {
          id: dto.id,
          rolFirmante: dto.rolFirmante,
          proposito: dto.proposito,
          nombreFirmante: dto.nombreFirmante,
          tipoDocumento: dto.tipoDocumento,
          numeroDocumento: dto.numeroDocumento,
          parentesco: dto.parentesco,
          cargo: dto.cargo,
          motivoSinFirma: dto.motivoSinFirma,
          detalleMotivo: dto.detalleMotivo,
          firmadaEn: dto.firmadaEn,
          imagen: archivo ? new Uint8Array(archivo.buffer) : undefined,
        },
        contexto,
      ),
    );
  }

  @Get(':firmaId/imagen')
  @RequiereRoles(Roles.PARAMEDICO, Roles.ADMINISTRADOR)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Imagen PNG de la firma (consulta auditada)' })
  @ApiProduces('image/png')
  @ApiOkResponse({ description: 'La imagen' })
  @ApiNotFoundResponse({
    description: 'No existe, no es de esa historia o es un "no firmó"',
  })
  async imagen(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('firmaId', ParseUUIDPipe) firmaId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<StreamableFile> {
    return respuestaImagenFirma(
      await this.obtenerImagen.ejecutar(
        id,
        firmaId,
        { usuarioId: usuario.id, rol: usuario.rol },
        contexto,
      ),
    );
  }

  @Delete(':firmaId')
  @RequiereRoles(Roles.PARAMEDICO)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Quitar una firma mal tomada (solo en borrador; se borra la imagen y queda auditado)',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  async quitarFirma(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('firmaId', ParseUUIDPipe) firmaId: string,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<void> {
    await this.quitar.ejecutar(id, firmaId, contexto);
  }
}
