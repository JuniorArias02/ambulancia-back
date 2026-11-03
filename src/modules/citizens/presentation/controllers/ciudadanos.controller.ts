import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../../../../common/constants/roles.js';
import { Contexto } from '../../../../common/decorators/contexto.decorator.js';
import { Publico } from '../../../../common/decorators/publico.decorator.js';
import { RequiereRoles } from '../../../../common/decorators/requiere_roles.decorator.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { ConsultarAccesoCiudadano } from '../../application/use-cases/consultar_acceso_ciudadano.use-case.js';
import { ActualizarContactoCiudadano } from '../../application/use-cases/actualizar_contacto_ciudadano.use-case.js';
import { ObtenerCiudadano } from '../../application/use-cases/obtener_ciudadano.use-case.js';
import { ReenviarVerificacion } from '../../application/use-cases/reenviar_verificacion.use-case.js';
import { RegistrarCiudadano } from '../../application/use-cases/registrar_ciudadano.use-case.js';
import { AccesoCiudadanoRespuestaDto } from '../dto/acceso_ciudadano_respuesta.dto.js';
import { ConsultarAccesoCiudadanoDto } from '../dto/consultar_acceso_ciudadano.dto.js';
import { ActualizarContactoCiudadanoDto } from '../dto/actualizar_contacto_ciudadano.dto.js';
import { PerfilCiudadanoRespuestaDto } from '../dto/perfil_ciudadano_respuesta.dto.js';
import {
  ReenviarVerificacionDto,
  ReenviarVerificacionFormularioDto,
} from '../dto/reenviar_verificacion.dto.js';
import {
  RegistrarCiudadanoDto,
  RegistrarCiudadanoFormularioDto,
} from '../dto/registrar_ciudadano.dto.js';
import {
  type ArchivosFormulario,
  archivosPorLado,
  CAMPOS_ARCHIVOS,
  exigirAmbasFotos,
  LIMITES_SUBIDA,
} from './archivos_recibidos.js';

@ApiTags('Ciudadanos')
@Controller('ciudadanos')
export class CiudadanosController {
  constructor(
    private readonly registrarCiudadano: RegistrarCiudadano,
    private readonly obtenerCiudadano: ObtenerCiudadano,
    private readonly actualizarContacto: ActualizarContactoCiudadano,
    private readonly reenviarVerificacion: ReenviarVerificacion,
    private readonly consultarAcceso: ConsultarAccesoCiudadano,
  ) {}

  @Post('acceso')
  @Publico()
  @HttpCode(HttpStatus.OK)
  // Revela si una cédula tiene cuenta: límite estricto contra la enumeración.
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @ApiOperation({
    summary:
      '¿La cédula tiene cuenta? Decide entre pedir la contraseña o registrarse',
    description:
      'Público. Solo cuenta cuentas de ciudadanos y solo responde sí o no. POST para que el documento no quede en URLs ni en logs.',
  })
  @ApiOkResponse({ type: AccesoCiudadanoRespuestaDto })
  @ApiUnprocessableEntityResponse({
    description: 'El documento no tiene entre 4 y 20 letras o números',
  })
  @ApiTooManyRequestsResponse({
    description: 'Más de 10 consultas en 15 minutos',
  })
  async acceso(
    @Body() dto: ConsultarAccesoCiudadanoDto,
  ): Promise<AccesoCiudadanoRespuestaDto> {
    return AccesoCiudadanoRespuestaDto.desde(
      await this.consultarAcceso.ejecutar(dto.numeroDocumento),
    );
  }

  @Post('registro')
  @Publico()
  // Cuenta nueva por IP: suficiente para una familia, poco para un abuso.
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @UseInterceptors(FileFieldsInterceptor(CAMPOS_ARCHIVOS, LIMITES_SUBIDA))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: RegistrarCiudadanoFormularioDto })
  @ApiOperation({
    summary:
      'Registrar una cuenta de ciudadano (queda pendiente de verificación)',
    description:
      'Público. El rol lo asigna el backend. Después se inicia sesión con POST /autenticacion/iniciar-sesion.',
  })
  @ApiCreatedResponse({ type: PerfilCiudadanoRespuestaDto })
  @ApiConflictResponse({
    description: 'Ya existe una cuenta con ese correo o ese documento',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Menor de edad, fecha inválida o foto inválida',
  })
  @ApiPayloadTooLargeResponse({ description: 'Una foto supera 5 MB' })
  @ApiTooManyRequestsResponse({
    description: 'Más de 5 registros en 15 minutos',
  })
  async registrar(
    @Body() dto: RegistrarCiudadanoDto,
    @UploadedFiles() archivos: ArchivosFormulario | undefined,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<PerfilCiudadanoRespuestaDto> {
    const { frontal, posterior } = exigirAmbasFotos(archivosPorLado(archivos));
    const ciudadano = await this.registrarCiudadano.ejecutar({
      nombres: dto.nombres,
      apellidos: dto.apellidos,
      tipoDocumento: dto.tipoDocumento,
      numeroDocumento: dto.numeroDocumento,
      fechaNacimiento: dto.fechaNacimiento,
      telefono: dto.telefono,
      correo: dto.correo,
      contrasena: dto.contrasena,
      documentoFrontal: frontal,
      documentoPosterior: posterior,
      direccionIp: contexto.direccionIp,
    });
    return PerfilCiudadanoRespuestaDto.desde(ciudadano);
  }

  @Get('perfil')
  @ApiBearerAuth()
  @RequiereRoles(Roles.CIUDADANO)
  @ApiOperation({ summary: 'Perfil y estado de verificación del ciudadano' })
  @ApiOkResponse({ type: PerfilCiudadanoRespuestaDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse({ description: 'No es un ciudadano' })
  async perfil(
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<PerfilCiudadanoRespuestaDto> {
    return PerfilCiudadanoRespuestaDto.desde(
      await this.obtenerCiudadano.ejecutar(contexto.usuarioId),
    );
  }

  @Patch('perfil')
  @ApiBearerAuth()
  @RequiereRoles(Roles.CIUDADANO)
  @ApiOperation({
    summary: 'Actualizar correo o teléfono',
    description:
      'Rol, identidad y estado de verificación no se editan aquí: un campo de más responde 400.',
  })
  @ApiOkResponse({ type: PerfilCiudadanoRespuestaDto })
  @ApiConflictResponse({ description: 'Ese correo ya está registrado' })
  async actualizar(
    @Body() dto: ActualizarContactoCiudadanoDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<PerfilCiudadanoRespuestaDto> {
    return PerfilCiudadanoRespuestaDto.desde(
      await this.actualizarContacto.ejecutar(dto, contexto),
    );
  }

  @Put('verificacion')
  @ApiBearerAuth()
  @RequiereRoles(Roles.CIUDADANO)
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @UseInterceptors(FileFieldsInterceptor(CAMPOS_ARCHIVOS, LIMITES_SUBIDA))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: ReenviarVerificacionFormularioDto })
  @ApiOperation({
    summary: 'Reenviar la verificación tras una solicitud de corrección',
    description:
      'Solo en estado requiere_correccion. Fotos nuevas y/o datos de identidad corregidos; vuelve a pendiente.',
  })
  @ApiOkResponse({ type: PerfilCiudadanoRespuestaDto })
  @ApiConflictResponse({
    description:
      'Documento ya registrado o la verificación cambió mientras tanto',
  })
  @ApiUnprocessableEntityResponse({
    description: 'No se pidió corrección, no envió nada o foto inválida',
  })
  @ApiPayloadTooLargeResponse({ description: 'Una foto supera 5 MB' })
  async reenviar(
    @Body() dto: ReenviarVerificacionDto,
    @UploadedFiles() archivos: ArchivosFormulario | undefined,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<PerfilCiudadanoRespuestaDto> {
    return PerfilCiudadanoRespuestaDto.desde(
      await this.reenviarVerificacion.ejecutar(
        {
          identidad: {
            nombres: dto.nombres,
            apellidos: dto.apellidos,
            tipoDocumento: dto.tipoDocumento,
            numeroDocumento: dto.numeroDocumento,
            fechaNacimiento: dto.fechaNacimiento,
          },
          archivos: archivosPorLado(archivos),
        },
        contexto,
      ),
    );
  }
}
