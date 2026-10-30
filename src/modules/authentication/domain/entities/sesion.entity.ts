export interface PropiedadesSesion {
  id: string;
  usuarioId: string;
  tokenHash: string;
  expiraEn: Date;
  revocadaEn: Date | null;
  creadaEn: Date;
}

export interface DatosNuevaSesion {
  id: string;
  usuarioId: string;
  tokenHash: string;
  expiraEn: Date;
}

/** Sesión respaldada en base de datos para poder revocar tokens JWT antes de su expiración. */
export class Sesion {
  private constructor(private readonly propiedades: PropiedadesSesion) {}

  static crear(datos: DatosNuevaSesion): Sesion {
    return new Sesion({ ...datos, revocadaEn: null, creadaEn: new Date() });
  }

  static reconstruir(propiedades: PropiedadesSesion): Sesion {
    return new Sesion({ ...propiedades });
  }

  get id(): string {
    return this.propiedades.id;
  }
  get usuarioId(): string {
    return this.propiedades.usuarioId;
  }
  get tokenHash(): string {
    return this.propiedades.tokenHash;
  }
  get expiraEn(): Date {
    return this.propiedades.expiraEn;
  }
  get revocadaEn(): Date | null {
    return this.propiedades.revocadaEn;
  }
  get creadaEn(): Date {
    return this.propiedades.creadaEn;
  }

  estaVigente(ahora: Date): boolean {
    return (
      this.propiedades.revocadaEn === null &&
      this.propiedades.expiraEn.getTime() > ahora.getTime()
    );
  }
}
