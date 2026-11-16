/** Los consecutivos diarios usan la fecha de Colombia, no la del servidor. */
const ZONA_HORARIA = 'America/Bogota';

/** "20261025" para la fecha dada, en hora de Colombia. */
export function diaColombia(fecha: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(fecha)
    .replaceAll('-', '');
}

/** "2026-10-25": el día de calendario en Colombia, en formato ISO. */
export function fechaColombia(fecha: Date): string {
  const dia = diaColombia(fecha);
  return `${dia.slice(0, 4)}-${dia.slice(4, 6)}-${dia.slice(6, 8)}`;
}

/** Colombia está en UTC−5 todo el año (sin horario de verano). */
const DESFASE_COLOMBIA_HORAS = 5;

/**
 * El instante (UTC) en que empieza el día `AAAA-MM-DD` en Colombia.
 * `null` si la fecha no existe (por ejemplo, 2026-02-30).
 */
export function inicioDiaColombia(fechaIso: string): Date | null {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  if (!anio || !mes || !dia) return null;
  const fecha = new Date(
    Date.UTC(anio, mes - 1, dia, DESFASE_COLOMBIA_HORAS, 0, 0, 0),
  );
  return fechaColombia(fecha) === fechaIso ? fecha : null;
}
