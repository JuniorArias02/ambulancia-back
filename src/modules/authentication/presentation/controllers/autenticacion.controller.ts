import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Contexto } from '../../../../common/decorators/contexto.decorator.js';
import { Publico } from '../../../../common/decorators/publico.decorator.js';
import { UsuarioActual } from '../../../../common/decorators/usuario_actual.decorator.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import type { UsuarioAutenticado } from '../../../../common/types/usuario_autenticado.js';
import { CambiarContrasena } from '../../application/use-cases/cambiar_contrasena.use-case.js';
import { CerrarSesion } from '../../application/use-cases/cerrar_sesion.use-case.js';
import { IniciarSesion } from '../../application/use-cases/iniciar_sesion.use-case.js';
import { ObtenerPerfil } from '../../application/use-cases/obtener_perfil.use-case.js';
import { CambiarContrasenaDto } from '../dto/cambiar_contrasena.dto.js';
import { IniciarSesionDto } from '../dto/iniciar_sesion.dto.js';
import { PerfilRespuestaDto } from '../dto/perfil_respuesta.dto.js';
import { SesionIniciadaRespuestaDto } from '../dto/sesion_iniciada_respuesta.dto.js';

@ApiTags('Autenticación')
@Controller('autenticacion')
export class AutenticacionController {
  constructor(
    private readonly iniciarSesion: IniciarSesion,
    private readonly cerrarSesion: CerrarSesion,
    private readonly obtenerPerfil: ObtenerPerfil,
    private readonly cambiarContrasena: CambiarContrasena,
  ) {}

  @Post('iniciar-sesion')
  @Publico()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión con correo y contraseña' })
  @ApiOkResponse({ type: SesionIniciadaRespuestaDto })
  @ApiUnauthorizedResponse({ description: 'Credenciales inválidas' })
  @ApiTooManyRequestsResponse({ description: 'Demasiados intentos' })
  async iniciar(
    @Body() dto: IniciarSesionDto,
    @Ip() direccionIp: string,
  ): Promise<SesionIniciadaRespuestaDto> {
    const sesion = await this.iniciarSesion.ejecutar({
      correo: dto.correo,
      contrasena: dto.contrasena,
      direccionIp,
    });
    return SesionIniciadaRespuestaDto.desde(sesion);
  }

  @Post('cerrar-sesion')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revocar la sesión actual' })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse()
  async cerrar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<void> {
    await this.cerrarSesion.ejecutar(usuario.sesionId, contexto);
  }

  @Get('perfil')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Datos y rol del usuario autenticado' })
  @ApiOkResponse({ type: PerfilRespuestaDto })
  @ApiUnauthorizedResponse()
  async perfil(
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<PerfilRespuestaDto> {
    return PerfilRespuestaDto.desde(
      await this.obtenerPerfil.ejecutar(usuario.id),
    );
  }

  @Patch('contrasena')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cambiar la contraseña propia',
    description: 'Revoca todas las sesiones; se debe iniciar sesión de nuevo.',
  })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse()
  @ApiUnprocessableEntityResponse({
    description: 'Contraseña actual incorrecta',
  })
  async cambiar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: CambiarContrasenaDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<void> {
    await this.cambiarContrasena.ejecutar(
      {
        usuarioId: usuario.id,
        contrasenaActual: dto.contrasenaActual,
        contrasenaNueva: dto.contrasenaNueva,
      },
      contexto,
    );
  }
}
