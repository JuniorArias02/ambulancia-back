import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class VerificarSesionDto {
  /** El `tokenAcceso` con el que el cliente abrió el WebSocket. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token: string;
}
