import { ApiProperty } from '@nestjs/swagger';
import type {
  AccesoCiudadano,
  SiguientePasoAcceso,
} from '../../application/use-cases/consultar_acceso_ciudadano.use-case.js';

export class AccesoCiudadanoRespuestaDto {
  @ApiProperty({ description: 'Hay una cuenta de ciudadano con ese documento' })
  registrado: boolean;

  @ApiProperty({
    enum: ['iniciar_sesion', 'registrarse'],
    description:
      'iniciar_sesion: pedir la contraseña (POST /autenticacion/iniciar-sesion-ciudadano) · registrarse: ir a POST /ciudadanos/registro',
  })
  siguientePaso: SiguientePasoAcceso;

  static desde(acceso: AccesoCiudadano): AccesoCiudadanoRespuestaDto {
    return {
      registrado: acceso.registrado,
      siguientePaso: acceso.siguientePaso,
    };
  }
}
