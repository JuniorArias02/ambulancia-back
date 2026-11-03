import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';

export const FUENTES_EMERGENCIA = [
  'linea_123',
  'telefono',
  'radio',
  'app',
] as const;
export type FuenteEmergencia = (typeof FUENTES_EMERGENCIA)[number];

export const TIPOS_INCIDENTE = [
  'accidente_transito',
  'caida',
  'arma',
  'quemadura',
  'clinico',
  'otro',
] as const;
export type TipoIncidente = (typeof TIPOS_INCIDENTE)[number];

export const PRIORIDADES_EMERGENCIA = ['roja', 'amarilla', 'verde'] as const;
export type PrioridadEmergencia = (typeof PRIORIDADES_EMERGENCIA)[number];

export const ESTADOS_EMERGENCIA = [
  'recibida',
  'despachada',
  'en_atencion',
  'cerrada',
  'cancelada',
] as const;
export type EstadoEmergencia = (typeof ESTADOS_EMERGENCIA)[number];

/** Cómo obtuvo el ciudadano las coordenadas de su reporte. */
export const ORIGENES_UBICACION = ['gps', 'manual'] as const;
export type OrigenUbicacion = (typeof ORIGENES_UBICACION)[number];

/** Estados en los que la emergencia sigue abierta. */
export const ESTADOS_ACTIVOS: readonly EstadoEmergencia[] = [
  'recibida',
  'despachada',
  'en_atencion',
];

/** El consecutivo diario usa la fecha de Colombia, no la del servidor. */
const ZONA_HORARIA = 'America/Bogota';

export interface Coordenadas {
  latitud: number;
  longitud: number;
}

export interface PropiedadesEmergencia {
  id: string;
  numeroEmergencia: string;
  fuente: FuenteEmergencia;
  informanteNombre: string | null;
  informanteTelefono: string | null;
  descripcion: string;
  tipoIncidente: TipoIncidente | null;
  prioridad: PrioridadEmergencia | null;
  direccion: string | null;
  referenciaLugar: string | null;
  coordenadas: Coordenadas | null;
  numeroVictimas: number | null;
  estado: EstadoEmergencia;
  emergenciaPrincipalId: string | null;
  recibidaPorId: string | null;
  /** El ciudadano que la reportó desde la app; `null` en los demás canales. */
  informanteUsuarioId: string | null;
  origenUbicacion: OrigenUbicacion | null;
  /** Solo lectura: nombre de quien la registró, para mostrarlo. */
  recibidaPorNombre: string | null;
  recibidaEn: Date;
  cerradaEn: Date | null;
}

export interface DatosNuevaEmergencia {
  /** Lo envía la app del ciudadano para que un reintento no duplique el reporte. */
  id?: string;
  numeroEmergencia: string;
  fuente: FuenteEmergencia;
  informanteNombre?: string | null;
  informanteTelefono?: string | null;
  descripcion: string;
  tipoIncidente?: TipoIncidente | null;
  prioridad?: PrioridadEmergencia | null;
  direccion?: string | null;
  referenciaLugar?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  numeroVictimas?: number | null;
  recibidaPorId: string | null;
  informanteUsuarioId?: string | null;
  origenUbicacion?: OrigenUbicacion | null;
  recibidaEn: Date;
}

/** `undefined` deja el valor igual; `null` lo borra. */
export interface DatosEditablesEmergencia {
  fuente?: FuenteEmergencia;
  informanteNombre?: string | null;
  informanteTelefono?: string | null;
  descripcion?: string;
  tipoIncidente?: TipoIncidente | null;
  prioridad?: PrioridadEmergencia | null;
  direccion?: string | null;
  referenciaLugar?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  numeroVictimas?: number | null;
}

export class Emergencia {
  private constructor(private readonly propiedades: PropiedadesEmergencia) {}

  static crear(datos: DatosNuevaEmergencia): Emergencia {
    const emergencia = new Emergencia({
      id: datos.id ?? crypto.randomUUID(),
      numeroEmergencia: datos.numeroEmergencia,
      fuente: datos.fuente,
      informanteNombre: Emergencia.limpiar(datos.informanteNombre),
      informanteTelefono: Emergencia.limpiar(datos.informanteTelefono),
      descripcion: Emergencia.validarDescripcion(datos.descripcion),
      tipoIncidente: datos.tipoIncidente ?? null,
      prioridad: datos.prioridad ?? null,
      direccion: Emergencia.limpiar(datos.direccion),
      referenciaLugar: Emergencia.limpiar(datos.referenciaLugar),
      coordenadas: Emergencia.armarCoordenadas(datos.latitud, datos.longitud),
      numeroVictimas: datos.numeroVictimas ?? null,
      // Nace recibida: despachada, en_atencion y cerrada las ponen las asignaciones.
      estado: 'recibida',
      emergenciaPrincipalId: null,
      recibidaPorId: datos.recibidaPorId,
      informanteUsuarioId: datos.informanteUsuarioId ?? null,
      origenUbicacion: datos.origenUbicacion ?? null,
      recibidaPorNombre: null,
      recibidaEn: datos.recibidaEn,
      cerradaEn: null,
    });
    emergencia.validarUbicacion();
    return emergencia;
  }

  static reconstruir(propiedades: PropiedadesEmergencia): Emergencia {
    return new Emergencia({ ...propiedades });
  }

  /** Prefijo del consecutivo del día: `EMG-20261024-`. */
  static prefijoNumero(fecha: Date): string {
    const dia = new Intl.DateTimeFormat('en-CA', {
      timeZone: ZONA_HORARIA,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(fecha)
      .replaceAll('-', '');
    return `EMG-${dia}-`;
  }

  static formatearNumero(fecha: Date, consecutivo: number): string {
    return `${Emergencia.prefijoNumero(fecha)}${String(consecutivo).padStart(4, '0')}`;
  }

  private static limpiar(texto: string | null | undefined): string | null {
    const limpio = texto?.trim();
    return limpio ? limpio : null;
  }

  private static validarDescripcion(descripcion: string): string {
    const limpia = descripcion.trim();
    if (!limpia) {
      throw new ReglaNegocioError('La descripción es obligatoria');
    }
    return limpia;
  }

  private static armarCoordenadas(
    latitud: number | null | undefined,
    longitud: number | null | undefined,
  ): Coordenadas | null {
    const hayLatitud = latitud !== null && latitud !== undefined;
    const hayLongitud = longitud !== null && longitud !== undefined;
    if (hayLatitud !== hayLongitud) {
      throw new ReglaNegocioError('Envíe la latitud y la longitud juntas');
    }
    return hayLatitud && hayLongitud ? { latitud, longitud } : null;
  }

  get id(): string {
    return this.propiedades.id;
  }
  get numeroEmergencia(): string {
    return this.propiedades.numeroEmergencia;
  }
  get fuente(): FuenteEmergencia {
    return this.propiedades.fuente;
  }
  get informanteNombre(): string | null {
    return this.propiedades.informanteNombre;
  }
  get informanteTelefono(): string | null {
    return this.propiedades.informanteTelefono;
  }
  get descripcion(): string {
    return this.propiedades.descripcion;
  }
  get tipoIncidente(): TipoIncidente | null {
    return this.propiedades.tipoIncidente;
  }
  get prioridad(): PrioridadEmergencia | null {
    return this.propiedades.prioridad;
  }
  get direccion(): string | null {
    return this.propiedades.direccion;
  }
  get referenciaLugar(): string | null {
    return this.propiedades.referenciaLugar;
  }
  get coordenadas(): Coordenadas | null {
    return this.propiedades.coordenadas;
  }
  get numeroVictimas(): number | null {
    return this.propiedades.numeroVictimas;
  }
  get estado(): EstadoEmergencia {
    return this.propiedades.estado;
  }
  get emergenciaPrincipalId(): string | null {
    return this.propiedades.emergenciaPrincipalId;
  }
  get recibidaPorId(): string | null {
    return this.propiedades.recibidaPorId;
  }
  get informanteUsuarioId(): string | null {
    return this.propiedades.informanteUsuarioId;
  }
  get origenUbicacion(): OrigenUbicacion | null {
    return this.propiedades.origenUbicacion;
  }
  get recibidaPorNombre(): string | null {
    return this.propiedades.recibidaPorNombre;
  }
  get recibidaEn(): Date {
    return this.propiedades.recibidaEn;
  }
  get cerradaEn(): Date | null {
    return this.propiedades.cerradaEn;
  }

  estaActiva(): boolean {
    return ESTADOS_ACTIVOS.includes(this.propiedades.estado);
  }

  esDuplicada(): boolean {
    return this.propiedades.emergenciaPrincipalId !== null;
  }

  /** Mientras siga activa se puede corregir; por ejemplo, re-clasificar la prioridad. */
  actualizarDatos(datos: DatosEditablesEmergencia): void {
    if (!this.estaActiva()) {
      throw new ReglaNegocioError(
        `No se puede editar una emergencia ${this.propiedades.estado}`,
      );
    }
    const p = this.propiedades;
    if (datos.fuente !== undefined) p.fuente = datos.fuente;
    if (datos.informanteNombre !== undefined) {
      p.informanteNombre = Emergencia.limpiar(datos.informanteNombre);
    }
    if (datos.informanteTelefono !== undefined) {
      p.informanteTelefono = Emergencia.limpiar(datos.informanteTelefono);
    }
    if (datos.descripcion !== undefined) {
      p.descripcion = Emergencia.validarDescripcion(datos.descripcion);
    }
    if (datos.tipoIncidente !== undefined)
      p.tipoIncidente = datos.tipoIncidente;
    if (datos.prioridad !== undefined) p.prioridad = datos.prioridad;
    if (datos.direccion !== undefined) {
      p.direccion = Emergencia.limpiar(datos.direccion);
    }
    if (datos.referenciaLugar !== undefined) {
      p.referenciaLugar = Emergencia.limpiar(datos.referenciaLugar);
    }
    if (datos.latitud !== undefined || datos.longitud !== undefined) {
      p.coordenadas = Emergencia.armarCoordenadas(
        datos.latitud,
        datos.longitud,
      );
    }
    if (datos.numeroVictimas !== undefined) {
      p.numeroVictimas = datos.numeroVictimas;
    }
    this.validarUbicacion();
  }

  /** Solo antes de despachar: después se cancela desde la asignación. */
  cancelar(fecha: Date): void {
    this.exigirRecibida('cancelar');
    this.propiedades.estado = 'cancelada';
    this.propiedades.cerradaEn = fecha;
  }

  /** Una llamada repetida se cierra apuntando a la emergencia que sí se atiende. */
  marcarDuplicadaDe(principal: Emergencia, fecha: Date): void {
    this.exigirRecibida('marcar como duplicada');
    if (principal.id === this.id) {
      throw new ReglaNegocioError(
        'Una emergencia no puede ser duplicada de sí misma',
      );
    }
    if (principal.esDuplicada()) {
      throw new ReglaNegocioError(
        `La emergencia ${principal.numeroEmergencia} ya es duplicada de otra; elija la principal`,
      );
    }
    if (principal.estado === 'cancelada') {
      throw new ReglaNegocioError(
        `La emergencia ${principal.numeroEmergencia} está cancelada`,
      );
    }
    this.propiedades.emergenciaPrincipalId = principal.id;
    this.propiedades.estado = 'cancelada';
    this.propiedades.cerradaEn = fecha;
  }

  // --- Transiciones que hacen las asignaciones, nunca un usuario a mano ---

  /** Al despachar la primera ambulancia. Las siguientes no cambian el estado. */
  despachar(): void {
    if (!this.estaActiva()) {
      throw new ReglaNegocioError(
        `No se puede despachar una emergencia ${this.propiedades.estado}`,
      );
    }
    if (this.esDuplicada()) {
      throw new ReglaNegocioError(
        'No se puede despachar una emergencia duplicada',
      );
    }
    if (this.propiedades.estado === 'recibida') {
      this.propiedades.estado = 'despachada';
    }
  }

  /** Cuando la primera ambulancia llega al sitio. */
  iniciarAtencion(): void {
    if (this.propiedades.estado === 'despachada') {
      this.propiedades.estado = 'en_atencion';
    }
  }

  /** Cuando termina el último servicio activo de la emergencia. */
  cerrar(fecha: Date): void {
    if (this.propiedades.estado !== 'en_atencion') {
      throw new ReglaNegocioError(
        `Solo se puede cerrar una emergencia en atención; esta está ${this.propiedades.estado}`,
      );
    }
    this.propiedades.estado = 'cerrada';
    this.propiedades.cerradaEn = fecha;
  }

  /** Se canceló la única ambulancia antes de llegar: hay que volver a despachar. */
  volverARecibida(): void {
    if (this.propiedades.estado === 'despachada') {
      this.propiedades.estado = 'recibida';
    }
  }

  private exigirRecibida(accion: string): void {
    if (this.propiedades.estado !== 'recibida') {
      throw new ReglaNegocioError(
        `Solo se puede ${accion} una emergencia recibida; esta está ${this.propiedades.estado}`,
      );
    }
  }

  private validarUbicacion(): void {
    if (!this.propiedades.direccion && !this.propiedades.coordenadas) {
      throw new ReglaNegocioError('Indique la dirección o las coordenadas');
    }
  }
}
