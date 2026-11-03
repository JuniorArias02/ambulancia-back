import { Injectable } from '@nestjs/common';
import { Ciudadano } from '../../domain/entities/ciudadano.entity.js';
import { CiudadanosRepositorio } from '../../domain/repositories/ciudadanos.repository.js';

export type SiguientePasoAcceso = 'iniciar_sesion' | 'registrarse';

export interface AccesoCiudadano {
  registrado: boolean;
  siguientePaso: SiguientePasoAcceso;
}

/**
 * Primer paso de la app: con la cédula decide si pedir la contraseña o llevar
 * al registro. Confirma que la cédula tiene cuenta (decisión de producto), así
 * que solo responde sí o no, solo por ciudadanos y con límite de frecuencia.
 */
@Injectable()
export class ConsultarAccesoCiudadano {
  constructor(private readonly ciudadanosRepositorio: CiudadanosRepositorio) {}

  async ejecutar(numeroDocumento: string): Promise<AccesoCiudadano> {
    const registrado =
      await this.ciudadanosRepositorio.existeCiudadanoConDocumento(
        Ciudadano.normalizarDocumento(numeroDocumento),
      );
    return {
      registrado,
      siguientePaso: registrado ? 'iniciar_sesion' : 'registrarse',
    };
  }
}
