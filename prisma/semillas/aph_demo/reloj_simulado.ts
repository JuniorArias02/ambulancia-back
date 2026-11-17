/**
 * Reloj de la semilla: los casos de uso toman la hora con `new Date()`, así
 * que para repartir los servicios en los últimos días se reemplaza `Date`
 * solo dentro de este proceso. La app no cambia.
 *
 * `new Date()` y `Date.now()` devuelven la hora simulada; `new Date(valor)`
 * se comporta igual que siempre.
 */
const DateReal = globalThis.Date;
let desfaseMs = 0;

class DateSimulada extends DateReal {
  constructor(...argumentos: [] | [number | string | Date] | number[]) {
    if (argumentos.length === 0) {
      super(DateReal.now() + desfaseMs);
    } else {
      // Mismas formas que el constructor original (valor, o año, mes, día...).
      super(...(argumentos as [number]));
    }
  }

  static override now(): number {
    return DateReal.now() + desfaseMs;
  }
}

export const reloj = {
  instalar(): void {
    globalThis.Date = DateSimulada as DateConstructor;
  },

  /** Deja la hora simulada en `fecha`; de ahí sigue corriendo normalmente. */
  en(fecha: Date): void {
    desfaseMs = fecha.getTime() - DateReal.now();
  },

  avanzar(minutos: number): void {
    desfaseMs += minutos * 60_000;
  },

  restablecer(): void {
    desfaseMs = 0;
    globalThis.Date = DateReal;
  },
};

/** Fecha y hora de Colombia (UTC-5, sin horario de verano) de hace `dias` días. */
export function haceDiasEnColombia(dias: number, hora: string): Date {
  const [horas, minutos] = hora.split(':').map(Number);
  const hoyColombia = new DateReal(DateReal.now() - 5 * 3_600_000);
  return new DateReal(
    DateReal.UTC(
      hoyColombia.getUTCFullYear(),
      hoyColombia.getUTCMonth(),
      hoyColombia.getUTCDate() - dias,
      (horas ?? 0) + 5,
      minutos ?? 0,
    ),
  );
}
