import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Publico } from '../../../../common/decorators/publico.decorator.js';
import { ClaveInternaGuard } from '../../../../common/guards/clave_interna.guard.js';
import { VerificarSesionToken } from '../../application/use-cases/verificar_sesion_token.use-case.js';
import { SesionVerificadaRespuestaDto } from '../dto/sesion_verificada_respuesta.dto.js';
import { VerificarSesionDto } from '../dto/verificar_sesion.dto.js';

/**
 * Solo para el servidor de tiempo real: no es parte del contrato del frontend.
 * Sin límite de solicitudes porque todas llegan desde la misma IP (ese servidor).
 */
@ApiExcludeController()
@Controller('interno/sesiones')
@Publico()
@SkipThrottle()
@UseGuards(ClaveInternaGuard)
export class SesionesInternasController {
  constructor(private readonly verificarSesionToken: VerificarSesionToken) {}

  @Post('verificar')
  @HttpCode(HttpStatus.OK)
  async verificar(
    @Body() dto: VerificarSesionDto,
  ): Promise<SesionVerificadaRespuestaDto> {
    return SesionVerificadaRespuestaDto.desde(
      await this.verificarSesionToken.ejecutar(dto.token),
    );
  }
}
