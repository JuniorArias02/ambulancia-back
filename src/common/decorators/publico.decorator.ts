import { SetMetadata } from '@nestjs/common';

export const ES_PUBLICO = 'es_publico';

/** Excluye la ruta de la autenticación JWT global. */
export const Publico = () => SetMetadata(ES_PUBLICO, true);
