import type { ContenidoToken } from './emisor_tokens.service.js';

export interface TokenVerificado extends ContenidoToken {
  expiraEn: Date;
}

export abstract class VerificadorTokens {
  /** Lanza `NoAutenticadoError` si la firma, el emisor o la vigencia no son válidos. */
  abstract verificar(token: string): Promise<TokenVerificado>;
}
