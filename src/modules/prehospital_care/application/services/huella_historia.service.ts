import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { FirmaCierreHistoria } from '../../domain/entities/historia_clinica.entity.js';
import type { DetalleHistoria } from '../../domain/repositories/historias_clinicas.repository.js';

/**
 * Huella SHA-256 del contenido al cerrar la historia: si alguien modificara
 * los datos en la base después, la huella ya no coincidiría. Se calcula sobre
 * un JSON con las claves ordenadas, para que el mismo contenido dé siempre
 * la misma huella.
 */
@Injectable()
export class HuellaHistoria {
  calcular(
    {
      historia,
      signosVitales,
      lesiones,
      intervenciones,
      valoracionesDownton,
      firmasHistoria,
    }: DetalleHistoria,
    firmaCierre: FirmaCierreHistoria | null = null,
  ): string {
    const porId = <T extends { id: string }>(lista: readonly T[]) =>
      [...lista].sort((a, b) => a.id.localeCompare(b.id));
    const contenido = {
      id: historia.id,
      numeroHistoria: historia.numeroHistoria,
      emergenciaId: historia.emergenciaId,
      asignacionId: historia.asignacionId,
      datos: sinCamposNuevosVacios(historia.datos),
      signosVitales: porId(signosVitales).map(sinNombreDeQuienRegistra),
      lesiones: porId(lesiones),
      intervenciones: porId(intervenciones).map(sinNombreDeQuienRegistra),
      // Solo si hay: así las historias sin valoraciones dan la misma huella
      // que antes de existir la escala (undefined no entra en el JSON).
      valoracionesDownton: valoracionesDownton.length
        ? porId(valoracionesDownton).map(sinNombreDeQuienRegistra)
        : undefined,
      // Firmas del paciente, acudiente, testigo y receptor: su huella entra en el sello.
      firmasHistoria: firmasHistoria.length
        ? porId(firmasHistoria).map((f) => ({
            id: f.id,
            rolFirmante: f.rolFirmante,
            proposito: f.proposito,
            nombreFirmante: f.nombreFirmante,
            tipoDocumento: f.tipoDocumento,
            numeroDocumento: f.numeroDocumento,
            parentesco: f.parentesco,
            cargo: f.cargo,
            huellaSha256: f.imagen?.huellaSha256 ?? null,
            motivoSinFirma: f.motivoSinFirma,
            detalleMotivo: f.detalleMotivo,
            textoVersion: f.textoVersion,
            firmadaEn: f.firmadaEn,
          }))
        : undefined,
      // La firma estampada: cambiar la imagen cambia su huella y rompe el sello.
      firmaCierre: firmaCierre
        ? { id: firmaCierre.id, huellaSha256: firmaCierre.huellaSha256 }
        : undefined,
    };
    return createHash('sha256').update(jsonOrdenado(contenido)).digest('hex');
  }
}

/**
 * Los campos que se agregaron después solo entran si tienen valor: así una
 * historia que no los usa da la misma huella que antes de que existieran.
 */
function sinCamposNuevosVacios(
  datos: DetalleHistoria['historia']['datos'],
): Partial<DetalleHistoria['historia']['datos']> {
  const { regimenAfiliacion, ...resto } = datos;
  return regimenAfiliacion === null ? resto : { ...resto, regimenAfiliacion };
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
