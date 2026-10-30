import { ApiProperty } from '@nestjs/swagger';
import type { SesionIniciada } from '../../application/use-cases/iniciar_sesion.use-case.js';
import { PerfilRespuestaDto } from './perfil_respuesta.dto.js';

export class SesionIniciadaRespuestaDto {
  @ApiProperty({ description: 'JWT para el encabezado Authorization: Bearer' })
  tokenAcceso: string;

  @ApiProperty({ example: 'Bearer' })
  tipoToken: 'Bearer';

  @ApiProperty({ description: 'Fecha de expiración del token (ISO 8601)' })
  expiraEn: Date;

  @ApiProperty({ type: PerfilRespuestaDto })
  usuario: PerfilRespuestaDto;

  static desde(sesion: SesionIniciada): SesionIniciadaRespuestaDto {
    return {
      tokenAcceso: sesion.tokenAcceso,
      tipoToken: 'Bearer',
      expiraEn: sesion.expiraEn,
      usuario: PerfilRespuestaDto.desde(sesion.usuario),
    };
  }
}
