import type { Ambulancia } from './ambulancia.entity.js';
import type { FuncionTripulante, Turno } from './turno.entity.js';

export const MOTIVOS_NO_SELECCIONABLE = [
  'ya_en_otra_ambulancia',
  'en_servicio',
  'mantenimiento',
  'conductor_ocupado',
  'tripulacion_llena',
] as const;
export type MotivoNoSeleccionable = (typeof MOTIVOS_NO_SELECCIONABLE)[number];
/** Los que dependen de la ambulancia; estar en otra depende de la persona. */
export type MotivoDeLaAmbulancia = Exclude<
  MotivoNoSeleccionable,
  'ya_en_otra_ambulancia'
>;

/**
 * Por qué alguien con esa función no puede subirse a la ambulancia. En servicio
 * no se admite a nadie: la tripulación que lo atiende queda fija hasta terminar.
 */
export function motivoNoSeleccionable(
  ambulancia: Ambulancia,
  turno: Turno | null,
  funcion: FuncionTripulante,
): MotivoDeLaAmbulancia | null {
  if (ambulancia.estadoOperativo === 'en_servicio') return 'en_servicio';
  if (ambulancia.estadoOperativo === 'mantenimiento') return 'mantenimiento';
  if (funcion === 'conductor' && turno?.tieneConductor()) {
    return 'conductor_ocupado';
  }
  if (turno?.estaLleno()) return 'tripulacion_llena';
  return null;
}
