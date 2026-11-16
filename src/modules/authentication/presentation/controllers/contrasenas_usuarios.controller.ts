import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
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
import { RestablecerContrasena } from '../../application/use-cases/restablecer_contrasena.use-case.js';
import { RestablecerContrasenaDto } from '../dto/restablecer_contrasena.dto.js';

/**
 * Vive en autenticación (dueño de las sesiones) aunque la ruta cuelga de
 * `/usuarios`, junto a las demás acciones del administrador sobre un usuario.
 */
@ApiTags('Usuarios')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({ description: 'Solo administradores' })
@RequiereRoles(Roles.ADMINISTRADOR)
@Controller('usuarios')
export class ContrasenasUsuariosController {
  constructor(private readonly restablecerContrasena: RestablecerContrasena) {}

  @Put(':id/contrasena')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Asignar una contraseña nueva a un usuario (solo administrador)',
    description:
      'No pide la contraseña actual. Cierra todas las sesiones del usuario. El administrador no puede usarlo sobre su propia cuenta.',
  })
  @ApiNoContentResponse({
    description: 'Contraseña cambiada y sesiones cerradas',
  })
  @ApiBadRequestResponse({ description: 'La contraseña no cumple la política' })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado' })
  @ApiUnprocessableEntityResponse({
    description: 'Es la cuenta del propio administrador',
  })
  @ApiTooManyRequestsResponse({ description: 'Demasiados intentos' })
  async restablecer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RestablecerContrasenaDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<void> {
    await this.restablecerContrasena.ejecutar(
      id,
      dto.contrasenaNueva,
      contexto,
    );
  }
}
