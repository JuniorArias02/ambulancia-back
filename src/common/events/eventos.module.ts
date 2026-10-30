import { Global, Module } from '@nestjs/common';
import { BusEventos } from './bus_eventos.js';
import { PublicadorEventos } from './publicador_eventos.js';

/**
 * Global y sin dependencias: los módulos de negocio publican sin importar a
 * quienes escuchan, y así no se forman dependencias circulares.
 */
@Global()
@Module({
  providers: [{ provide: PublicadorEventos, useClass: BusEventos }],
  exports: [PublicadorEventos],
})
export class EventosModule {}
