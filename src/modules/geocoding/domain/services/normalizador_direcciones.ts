/**
 * Normaliza direcciones colombianas para que distintas formas de escribir la
 * misma dirección compartan el resultado guardado:
 * "Cl. 72 # 15-20" = "calle 72 no 15 20" = "CALLE 72 #15-20".
 */
const ABREVIATURAS: Readonly<Record<string, string>> = {
  cl: 'calle',
  cll: 'calle',
  clle: 'calle',
  kr: 'carrera',
  kra: 'carrera',
  cra: 'carrera',
  cr: 'carrera',
  carr: 'carrera',
  av: 'avenida',
  avd: 'avenida',
  avda: 'avenida',
  ak: 'avenida carrera',
  ac: 'avenida calle',
  dg: 'diagonal',
  diag: 'diagonal',
  tv: 'transversal',
  tr: 'transversal',
  trans: 'transversal',
  transv: 'transversal',
  // "No.", "Nro.", "N°" y "#" significan lo mismo: se eliminan.
  no: '',
  nro: '',
  num: '',
  numero: '',
};

/** Separa "cl72" o "kr15" en "cl 72" y "kr 15". */
const ABREVIATURA_PEGADA = new RegExp(
  `\\b(${Object.keys(ABREVIATURAS)
    .filter((clave) => ABREVIATURAS[clave] !== '')
    .join('|')}|calle|carrera|avenida|diagonal|transversal)(\\d)`,
  'g',
);

export const LONGITUD_MAXIMA_CLAVE = 320;

function textoBase(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/n[°º]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function normalizarDireccion(direccion: string): string {
  return textoBase(direccion)
    .replace(ABREVIATURA_PEGADA, '$1 $2')
    .split(' ')
    .map((palabra) => ABREVIATURAS[palabra] ?? palabra)
    .filter((palabra) => palabra !== '')
    .join(' ');
}

export function normalizarCiudad(ciudad: string): string {
  return textoBase(ciudad).replace(/\s+/g, ' ');
}

/**
 * Clave única de la caché. Incluye el país y la ciudad porque "calle 10 # 5-20"
 * existe en casi todas las ciudades del país.
 */
export function claveGeocodificacion(datos: {
  direccion: string;
  ciudad: string | null;
  pais: string | null;
}): string {
  return [
    datos.pais ?? '',
    datos.ciudad ? normalizarCiudad(datos.ciudad) : '',
    normalizarDireccion(datos.direccion),
  ].join('|');
}

const PUNTOS_CARDINALES: Readonly<Record<string, string>> = {
  s: 'sur',
  sur: 'sur',
  e: 'este',
  este: 'este',
  n: 'norte',
  norte: 'norte',
  o: 'oeste',
  oe: 'oeste',
  oeste: 'oeste',
};

/** Vías de la nomenclatura urbana colombiana (ya normalizadas). */
const VIAS = new Set([
  'calle',
  'carrera',
  'avenida',
  'diagonal',
  'transversal',
]);

/**
 * Núcleo de una dirección con nomenclatura colombiana: vía, número de vía,
 * número de cruce y placa, con sus letras y puntos cardinales. Por ejemplo,
 * "Calle 72 Sur # 15A-20 apto 301" → "calle 72 sur 15a 20". Devuelve null si
 * el texto no sigue esa nomenclatura (por ejemplo, el nombre de un lugar).
 */
export function nucleoNomenclatura(texto: string): string | null {
  const palabras = normalizarDireccion(texto).split(' ');
  if (!VIAS.has(palabras[0] ?? '')) return null;

  const unidas: string[] = [];
  for (const palabra of palabras) {
    const anterior = unidas.at(-1);
    // "72 a" y "72a" son lo mismo; solo letras A a D, para no confundir la E de Este.
    if (anterior && /^\d+$/.test(anterior) && /^[a-d]$/.test(palabra)) {
      unidas[unidas.length - 1] = `${anterior}${palabra}`;
    } else {
      unidas.push(PUNTOS_CARDINALES[palabra] ?? palabra);
    }
  }

  const nucleo: string[] = [];
  let numeros = 0;
  for (const palabra of unidas) {
    nucleo.push(palabra);
    if (/^\d/.test(palabra) && ++numeros === 3) return nucleo.join(' ');
  }
  return null;
}

/**
 * ¿El resultado del proveedor es la misma dirección que se pidió? Los
 * proveedores devuelven direcciones parecidas con mucha confianza (por
 * ejemplo, "Calle 72 Sur # 15A-20" para "Calle 72 # 15-20"), así que no basta
 * con su puntaje. Si lo pedido no sigue la nomenclatura, no se puede comparar
 * y se confía en los filtros del proveedor.
 */
export function coincideNomenclatura(
  solicitada: string,
  encontrada: string | null,
): boolean {
  const esperado = nucleoNomenclatura(solicitada);
  if (esperado === null) return true;
  if (!encontrada) return false;
  // El proveedor agrega barrio, ciudad y país después de la primera coma.
  return nucleoNomenclatura(encontrada.split(',')[0] ?? '') === esperado;
}
