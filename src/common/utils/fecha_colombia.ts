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
