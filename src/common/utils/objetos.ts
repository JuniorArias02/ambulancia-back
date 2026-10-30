/**
 * Copia de `base` con los campos de `cambios` que vienen definidos.
 * `undefined` significa "no tocar"; `null` sí se aplica (borra el dato).
 */
export function fusionarDefinidos<T extends object>(
  base: T,
  cambios: Partial<T>,
): T {
  const resultado = { ...base };
  // Object.keys pierde el tipo de las claves: se recupera aquí, una sola vez.
  for (const clave of Object.keys(cambios) as (keyof T)[]) {
    const valor = cambios[clave];
    if (valor !== undefined) resultado[clave] = valor;
  }
  return resultado;
}
