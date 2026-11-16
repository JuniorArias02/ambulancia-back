import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiProduces,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../../../../common/constants/roles.js';
import { Contexto } from '../../../../common/decorators/contexto.decorator.js';
import { RequiereRoles } from '../../../../common/decorators/requiere_roles.decorator.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { ObtenerImagenFirma } from '../../application/use-cases/obtener_imagen_firma.use-case.js';
import { ObtenerMiFirma } from '../../application/use-cases/obtener_mi_firma.use-case.js';
import { RegistrarMiFirma } from '../../application/use-cases/registrar_mi_firma.use-case.js';
import {
  FirmaUsuarioRespuestaDto,
  MiFirmaRespuestaDto,
  RegistrarMiFirmaDto,
  RegistrarMiFirmaFormularioDto,
} from '../dto/firma_usuario.dto.js';
import {
  type ArchivoFirmaRecibido,
  limitesSubidaFirma,
  respuestaImagenFirma,
} from './imagen_firma_respuesta.js';

/** La firma propia del profesional, que se estampa en las historias que cierra. */
@ApiTags('Firmas')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({ description: 'Solo el paramédico' })
@RequiereRoles(Roles.PARAMEDICO)
@Controller('mi-firma')
export class MiFirmaController {
  constructor(
    private readonly registrarFirma: RegistrarMiFirma,
    private readonly obtenerFirma: ObtenerMiFirma,
    private readonly obtenerImagen: ObtenerImagenFirma,
  ) {}

  @Get()
  @ApiOperation({
    summary: '¿Tengo firma registrada? Sus datos, sin la imagen',
  })
  @ApiOkResponse({ type: MiFirmaRespuestaDto })
  async consultar(
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<MiFirmaRespuestaDto> {
    return MiFirmaRespuestaDto.desde(
      await this.obtenerFirma.ejecutar(contexto),
    );
  }

  @Get('imagen')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Mi firma vigente, en PNG (consulta auditada)' })
  @ApiProduces('image/png')
  @ApiOkResponse({ description: 'La imagen' })
  @ApiNotFoundResponse({ description: 'No tiene firma registrada' })
  async imagen(
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<StreamableFile> {
    const { contenido } = await this.obtenerImagen.propia(contexto);
    return respuestaImagenFirma(contenido);
  }

  @Post()
  // La contraseña se puede adivinar por aquí: mismo límite que el login.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  // Un solo campo de texto (contrasena), con margen.
  @UseInterceptors(FileInterceptor('imagen', limitesSubidaFirma(5)))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: RegistrarMiFirmaFormularioDto })
  @ApiOperation({
    summary:
      'Registrar o cambiar mi firma (dibujo + contraseña). La anterior queda como reemplazada',
  })
  @ApiCreatedResponse({ type: FirmaUsuarioRespuestaDto })
  @ApiUnprocessableEntityResponse({
    description: 'Contraseña incorrecta o imagen inválida (no es PNG, tamaño)',
  })
  @ApiPayloadTooLargeResponse({ description: 'La imagen supera 200 KB' })
  @ApiTooManyRequestsResponse({ description: 'Más de 5 intentos por minuto' })
  async registrar(
    @Body() dto: RegistrarMiFirmaDto,
    @UploadedFile() archivo: ArchivoFirmaRecibido | undefined,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<FirmaUsuarioRespuestaDto> {
    if (!archivo) {
      throw new BadRequestException(
        'Adjunte la imagen de la firma en "imagen"',
      );
    }
    return FirmaUsuarioRespuestaDto.desde(
      await this.registrarFirma.ejecutar(
        { imagen: new Uint8Array(archivo.buffer), contrasena: dto.contrasena },
        contexto,
      ),
    );
  }
}
