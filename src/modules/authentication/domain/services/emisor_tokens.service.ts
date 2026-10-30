export interface ContenidoToken {
  usuarioId: string;
  sesionId: string;
}

export interface TokenEmitido {
  token: string;
  /** Huella del token para almacenarla sin guardar el token completo. */
  tokenHash: string;
  expiraEn: Date;
}

export abstract class EmisorTokens {
  abstract emitir(contenido: ContenidoToken): Promise<TokenEmitido>;
}
