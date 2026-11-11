import {
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';

/** Los mismos tamaños de las columnas en la base de datos. */
export const LONGITUDES_LISTA = {
  nombre: 150,
  descripcion: 255,
  pregunta: 500,
  nombreEstado: 60,
} as const;

export interface ItemListaChequeo {
  id: string;
  pregunta: string;
  orden: number;
  obligatorio: boolean;
  permiteObservacion: boolean;
  activo: boolean;
}

export interface EstadoListaChequeo {
  id: string;
  nombre: string;
  valor: number | null;
  orden: number;
  activo: boolean;
}

export interface DatosNuevoItem {
  pregunta: string;
  orden?: number;
  obligatorio?: boolean;
  permiteObservacion?: boolean;
}

export interface DatosNuevoEstado {
  nombre: string;
  valor?: number | null;
  orden?: number;
}

/** `undefined` deja el valor como está. */
export interface CambiosItem {
  pregunta?: string;
  orden?: number;
  obligatorio?: boolean;
  permiteObservacion?: boolean;
  activo?: boolean;
}

export interface CambiosEstado {
  nombre?: string;
  valor?: number | null;
  orden?: number;
  activo?: boolean;
}

export interface PropiedadesListaChequeo {
  id: string;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
  creadaPorId: string;
  creadaEn: Date;
  actualizadaEn: Date | null;
  items: ItemListaChequeo[];
  estados: EstadoListaChequeo[];
}

/**
 * Formulario de chequeo que configura el administrador. Nada se borra: las
 * respuestas viejas apuntan a sus preguntas y estados, así que se desactivan.
 */
export class ListaChequeo {
  private constructor(private readonly propiedades: PropiedadesListaChequeo) {}

  static crear(datos: {
    nombre: string;
    descripcion?: string | null;
    creadaPorId: string;
    items: DatosNuevoItem[];
    estados: DatosNuevoEstado[];
    fecha: Date;
  }): ListaChequeo {
    if (datos.items.length < 1) {
      throw new ReglaNegocioError('La lista necesita al menos una pregunta');
    }
    if (datos.estados.length < 2) {
      throw new ReglaNegocioError(
        'La lista necesita al menos dos opciones de calificación',
      );
    }

    const lista = new ListaChequeo({
      id: crypto.randomUUID(),
      nombre: ListaChequeo.texto(
        datos.nombre,
        'El nombre',
        LONGITUDES_LISTA.nombre,
      ),
      descripcion: ListaChequeo.textoOpcional(datos.descripcion),
      // Nace inactiva: se activa después, y así se desactivan las demás.
      activa: false,
      creadaPorId: datos.creadaPorId,
      creadaEn: datos.fecha,
      actualizadaEn: null,
      items: [],
      estados: [],
    });
    datos.items.forEach((item, indice) =>
      lista.agregarItem({ ...item, orden: item.orden ?? indice }),
    );
    datos.estados.forEach((estado, indice) =>
      lista.agregarEstado({ ...estado, orden: estado.orden ?? indice }),
    );
    return lista;
  }

  static reconstruir(propiedades: PropiedadesListaChequeo): ListaChequeo {
    return new ListaChequeo({
      ...propiedades,
      items: propiedades.items.map((i) => ({ ...i })),
      estados: propiedades.estados.map((e) => ({ ...e })),
    });
  }

  get id(): string {
    return this.propiedades.id;
  }
  get nombre(): string {
    return this.propiedades.nombre;
  }
  get descripcion(): string | null {
    return this.propiedades.descripcion;
  }
  get activa(): boolean {
    return this.propiedades.activa;
  }
  get creadaPorId(): string {
    return this.propiedades.creadaPorId;
  }
  get creadaEn(): Date {
    return this.propiedades.creadaEn;
  }
  get actualizadaEn(): Date | null {
    return this.propiedades.actualizadaEn;
  }
  get items(): readonly ItemListaChequeo[] {
    return this.propiedades.items;
  }
  get estados(): readonly EstadoListaChequeo[] {
    return this.propiedades.estados;
  }

  itemsActivos(): ItemListaChequeo[] {
    return this.propiedades.items
      .filter((i) => i.activo)
      .sort((a, b) => a.orden - b.orden);
  }

  estadosActivos(): EstadoListaChequeo[] {
    return this.propiedades.estados
      .filter((e) => e.activo)
      .sort((a, b) => a.orden - b.orden);
  }

  buscarItem(itemId: string): ItemListaChequeo | null {
    return this.propiedades.items.find((i) => i.id === itemId) ?? null;
  }

  buscarEstado(estadoId: string): EstadoListaChequeo | null {
    return this.propiedades.estados.find((e) => e.id === estadoId) ?? null;
  }

  actualizarDatos(
    datos: { nombre?: string; descripcion?: string | null },
    fecha: Date,
  ): void {
    if (datos.nombre !== undefined) {
      this.propiedades.nombre = ListaChequeo.texto(
        datos.nombre,
        'El nombre',
        LONGITUDES_LISTA.nombre,
      );
    }
    if (datos.descripcion !== undefined) {
      this.propiedades.descripcion = ListaChequeo.textoOpcional(
        datos.descripcion,
      );
    }
    this.propiedades.actualizadaEn = fecha;
  }

  activar(fecha: Date): void {
    this.propiedades.activa = true;
    this.propiedades.actualizadaEn = fecha;
  }

  desactivar(fecha: Date): void {
    this.propiedades.activa = false;
    this.propiedades.actualizadaEn = fecha;
  }

  agregarItem(datos: DatosNuevoItem): ItemListaChequeo {
    const pregunta = ListaChequeo.texto(
      datos.pregunta,
      'La pregunta',
      LONGITUDES_LISTA.pregunta,
    );
    this.exigirPreguntaUnica(pregunta);
    const item: ItemListaChequeo = {
      id: crypto.randomUUID(),
      pregunta,
      orden: ListaChequeo.orden(datos.orden ?? this.propiedades.items.length),
      obligatorio: datos.obligatorio ?? true,
      permiteObservacion: datos.permiteObservacion ?? true,
      activo: true,
    };
    this.propiedades.items.push(item);
    return item;
  }

  actualizarItem(itemId: string, cambios: CambiosItem): ItemListaChequeo {
    const item = this.buscarItem(itemId);
    if (!item) throw new RecursoNoEncontradoError('Pregunta');

    if (cambios.pregunta !== undefined) {
      const pregunta = ListaChequeo.texto(
        cambios.pregunta,
        'La pregunta',
        LONGITUDES_LISTA.pregunta,
      );
      this.exigirPreguntaUnica(pregunta, item.id);
      item.pregunta = pregunta;
    }
    if (cambios.orden !== undefined)
      item.orden = ListaChequeo.orden(cambios.orden);
    if (cambios.obligatorio !== undefined)
      item.obligatorio = cambios.obligatorio;
    if (cambios.permiteObservacion !== undefined) {
      item.permiteObservacion = cambios.permiteObservacion;
    }
    if (cambios.activo === false && item.activo) {
      if (this.itemsActivos().length === 1) {
        throw new ReglaNegocioError(
          'La lista debe conservar al menos una pregunta activa',
        );
      }
    }
    if (cambios.activo !== undefined) item.activo = cambios.activo;
    return item;
  }

  agregarEstado(datos: DatosNuevoEstado): EstadoListaChequeo {
    const nombre = ListaChequeo.texto(
      datos.nombre,
      'El nombre de la opción',
      LONGITUDES_LISTA.nombreEstado,
    );
    this.exigirNombreEstadoUnico(nombre);
    const estado: EstadoListaChequeo = {
      id: crypto.randomUUID(),
      nombre,
      valor: datos.valor ?? null,
      orden: ListaChequeo.orden(datos.orden ?? this.propiedades.estados.length),
      activo: true,
    };
    this.propiedades.estados.push(estado);
    return estado;
  }

  actualizarEstado(
    estadoId: string,
    cambios: CambiosEstado,
  ): EstadoListaChequeo {
    const estado = this.buscarEstado(estadoId);
    if (!estado) throw new RecursoNoEncontradoError('Opción de calificación');

    if (cambios.nombre !== undefined) {
      const nombre = ListaChequeo.texto(
        cambios.nombre,
        'El nombre de la opción',
        LONGITUDES_LISTA.nombreEstado,
      );
      this.exigirNombreEstadoUnico(nombre, estado.id);
      estado.nombre = nombre;
    }
    if (cambios.valor !== undefined) estado.valor = cambios.valor;
    if (cambios.orden !== undefined) {
      estado.orden = ListaChequeo.orden(cambios.orden);
    }
    if (cambios.activo === false && estado.activo) {
      if (this.estadosActivos().length <= 2) {
        throw new ReglaNegocioError(
          'La lista debe conservar al menos dos opciones de calificación activas',
        );
      }
    }
    if (cambios.activo !== undefined) estado.activo = cambios.activo;
    return estado;
  }

  /** Compara sin mayúsculas ni espacios de más: "¿Luces?" y "  ¿luces? " son la misma. */
  private exigirPreguntaUnica(pregunta: string, excluirId?: string): void {
    const clave = ListaChequeo.clave(pregunta);
    const repetida = this.propiedades.items.some(
      (i) => i.id !== excluirId && ListaChequeo.clave(i.pregunta) === clave,
    );
    if (repetida) {
      throw new ReglaNegocioError(
        `La pregunta "${pregunta}" ya está en la lista`,
      );
    }
  }

  private exigirNombreEstadoUnico(nombre: string, excluirId?: string): void {
    const clave = ListaChequeo.clave(nombre);
    const repetido = this.propiedades.estados.some(
      (e) => e.id !== excluirId && ListaChequeo.clave(e.nombre) === clave,
    );
    if (repetido) {
      throw new ReglaNegocioError(`La opción "${nombre}" ya está en la lista`);
    }
  }

  private static texto(valor: string, campo: string, maximo: number): string {
    const limpio = valor.trim().replace(/\s+/g, ' ');
    if (!limpio) throw new ReglaNegocioError(`${campo} es obligatorio`);
    if (limpio.length > maximo) {
      throw new ReglaNegocioError(
        `${campo} admite máximo ${maximo} caracteres`,
      );
    }
    return limpio;
  }

  private static textoOpcional(
    valor: string | null | undefined,
  ): string | null {
    const limpio = valor?.trim();
    if (!limpio) return null;
    if (limpio.length > LONGITUDES_LISTA.descripcion) {
      throw new ReglaNegocioError(
        `La descripción admite máximo ${LONGITUDES_LISTA.descripcion} caracteres`,
      );
    }
    return limpio;
  }

  private static orden(valor: number): number {
    if (!Number.isInteger(valor) || valor < 0) {
      throw new ReglaNegocioError(
        'El orden debe ser un entero mayor o igual a 0',
      );
    }
    return valor;
  }

  private static clave(texto: string): string {
    return texto.trim().replace(/\s+/g, ' ').toLowerCase();
  }
}
