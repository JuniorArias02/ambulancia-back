import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { DetalleHistoria } from '../../domain/repositories/historias_clinicas.repository.js';

/**
 * Huella SHA-256 del contenido al cerrar la historia: si alguien modificara
 * los datos en la base después, la huella ya no coincidiría. Se calcula sobre
 * un JSON con las claves ordenadas, para que el mismo contenido dé siempre
 * la misma huella.
 */
@Injectable()
export class HuellaHistoria {
  calcular({
    historia,
    signosVitales,
    lesiones,
    intervenciones,
  }: DetalleHistoria): string {
    const porId = <T extends { id: string }>(lista: readonly T[]) =>
      [...lista].sort((a, b) => a.id.localeCompare(b.id));
    const contenido = {
      id: historia.id,
      numeroHistoria: historia.numeroHistoria,
      emergenciaId: historia.emergenciaId,
      asignacionId: historia.asignacionId,
      datos: historia.datos,
      signosVitales: porId(signosVitales).map(sinNombreDeQuienRegistra),
      lesiones: porId(lesiones),
      intervenciones: porId(intervenciones).map(sinNombreDeQuienRegistra),
    };
    return createHash('sha256').update(jsonOrdenado(contenido)).digest('hex');
  }
}

/** El nombre es solo para mostrar: puede cambiar sin que cambie el contenido clínico. */
function sinNombreDeQuienRegistra<
  T extends { registradoPorNombre: string | null },
>(registro: T): Omit<T, 'registradoPorNombre'> {
  const { registradoPorNombre: _nombre, ...resto } = registro;
  return resto;
}

function jsonOrdenado(valor: unknown): string {
  if (valor instanceof Date) return JSON.stringify(valor.toISOString());
  if (Array.isArray(valor)) return `[${valor.map(jsonOrdenado).join(',')}]`;
  if (valor !== null && typeof valor === 'object') {
    const entradas = Object.entries(valor)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entradas.map(([k, v]) => `${JSON.stringify(k)}:${jsonOrdenado(v)}`).join(',')}}`;
  }
  return JSON.stringify(valor);
}
