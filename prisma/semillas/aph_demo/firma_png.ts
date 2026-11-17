/**
 * Dibuja una firma a mano alzada como PNG (fondo transparente, trazo negro),
 * igual a lo que envía el lienzo de la app. Cada nombre da un trazo distinto
 * y siempre el mismo. Solo usa `zlib` de Node.
 */
import { crc32, deflateSync } from 'node:zlib';

const ANCHO = 600;
const ALTO = 200;
const GROSOR = 2.2;

/** Generador pseudoaleatorio con semilla (mulberry32): mismo nombre, misma firma. */
function aleatorioDesde(texto: string): () => number {
  let semilla = 0;
  for (const caracter of texto) {
    semilla = (Math.imul(semilla, 31) + (caracter.codePointAt(0) ?? 0)) | 0;
  }
  return () => {
    semilla = (semilla + 0x6d2b79f5) | 0;
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

class Lienzo {
  readonly pixeles = new Uint8Array(ANCHO * ALTO * 4);

  /** Un punto del trazo con borde suavizado. */
  punto(x: number, y: number): void {
    const radio = GROSOR + 1;
    for (let py = Math.floor(y - radio); py <= Math.ceil(y + radio); py++) {
      for (let px = Math.floor(x - radio); px <= Math.ceil(x + radio); px++) {
        if (px < 0 || py < 0 || px >= ANCHO || py >= ALTO) continue;
        const distancia = Math.hypot(px - x, py - y);
        const opacidad = Math.max(0, Math.min(1, GROSOR - distancia + 0.5));
        const i = (py * ANCHO + px) * 4 + 3;
        this.pixeles[i] = Math.max(
          this.pixeles[i] ?? 0,
          Math.round(opacidad * 255),
        );
      }
    }
  }

  linea(x1: number, y1: number, x2: number, y2: number): void {
    const pasos = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 2));
    for (let paso = 0; paso <= pasos; paso++) {
      const t = paso / pasos;
      this.punto(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
    }
  }

  trazo(puntos: readonly [number, number][]): void {
    for (let i = 1; i < puntos.length; i++) {
      const [x1, y1] = puntos[i - 1] ?? [0, 0];
      const [x2, y2] = puntos[i] ?? [0, 0];
      this.linea(x1, y1, x2, y2);
    }
  }
}

function fragmento(tipo: string, datos: Uint8Array): Buffer {
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const control = Buffer.alloc(4);
  control.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, control]);
}

function codificarPng(lienzo: Lienzo): Uint8Array {
  const encabezado = Buffer.alloc(13);
  encabezado.writeUInt32BE(ANCHO, 0);
  encabezado.writeUInt32BE(ALTO, 4);
  encabezado[8] = 8; // bits por canal
  encabezado[9] = 6; // RGBA
  // compresión, filtro y entrelazado: 0

  // Cada fila empieza con el byte de filtro (0 = sin filtro).
  const filas = Buffer.alloc((ANCHO * 4 + 1) * ALTO);
  for (let y = 0; y < ALTO; y++) {
    const inicio = y * (ANCHO * 4 + 1);
    filas[inicio] = 0;
    filas.set(
      lienzo.pixeles.subarray(y * ANCHO * 4, (y + 1) * ANCHO * 4),
      inicio + 1,
    );
  }

  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      fragmento('IHDR', encabezado),
      fragmento('IDAT', deflateSync(filas, { level: 9 })),
      fragmento('IEND', new Uint8Array(0)),
    ]),
  );
}

/** Firma de 600x200 para `nombre`: rúbrica con bucles y un subrayado. */
export function dibujarFirma(nombre: string): Uint8Array {
  const azar = aleatorioDesde(nombre);
  const lienzo = new Lienzo();

  // Rúbrica: avanza de izquierda a derecha con bucles de tamaño variable.
  const inicioX = 40 + azar() * 40;
  const finX = 420 + azar() * 120;
  const base = 115 + azar() * 20;
  const bucles = 4 + Math.floor(azar() * 4);
  const variacion = 1 + azar();
  const rubrica: [number, number][] = [];
  const muestras = 900;
  for (let i = 0; i <= muestras; i++) {
    const t = i / muestras;
    const fase = t * bucles * Math.PI * 2;
    const amplitud = 35 + 25 * Math.sin(t * Math.PI * variacion);
    const x = inicioX + (finX - inicioX) * t + Math.cos(fase) * 18;
    const y = base - Math.sin(fase) * amplitud * (0.6 + 0.4 * Math.sin(t * 7));
    rubrica.push([x, y]);
  }
  lienzo.trazo(rubrica);

  // Subrayado ligeramente curvo.
  const subrayado: [number, number][] = [];
  const alturaSubrayado = base + 40 + azar() * 15;
  for (let x = inicioX - 10; x <= finX + 30; x += 4) {
    const t = (x - inicioX) / (finX - inicioX);
    subrayado.push([x, alturaSubrayado - 12 * Math.sin(t * Math.PI)]);
  }
  lienzo.trazo(subrayado);

  return codificarPng(lienzo);
}
