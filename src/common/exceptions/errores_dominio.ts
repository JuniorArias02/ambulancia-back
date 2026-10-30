/**
 * Errores esperados de negocio. No dependen de NestJS ni de HTTP:
 * el filtro global los traduce al código de estado correspondiente.
 */
export abstract class ErrorDominio extends Error {
  protected constructor(mensaje: string) {
    super(mensaje);
    this.name = new.target.name;
  }
}

export class RecursoNoEncontradoError extends ErrorDominio {
  constructor(recurso: string) {
    super(`${recurso} no encontrado`);
  }
}

export class ConflictoNegocioError extends ErrorDominio {
  constructor(mensaje: string) {
    super(mensaje);
  }
}

export class ReglaNegocioError extends ErrorDominio {
  constructor(mensaje: string) {
    super(mensaje);
  }
}

export class NoAutenticadoError extends ErrorDominio {
  constructor(mensaje = 'Credenciales inválidas') {
    super(mensaje);
  }
}

export class AccesoDenegadoError extends ErrorDominio {
  constructor(mensaje = 'No tiene permisos para realizar esta acción') {
    super(mensaje);
  }
}

/** Un servicio externo del que depende la operación no respondió o no está configurado. */
export class ServicioNoDisponibleError extends ErrorDominio {
  constructor(mensaje: string) {
    super(mensaje);
  }
}
