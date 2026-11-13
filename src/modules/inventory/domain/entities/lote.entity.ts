import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import { fusionarDefinidos } from '../../../../common/utils/objetos.js';
import {
  exigirOrden,
  fechaOpcional,
  noEnElFuturo,
  textoObligatorio,
  textoOpcional,
} from '../services/validaciones.js';
import type { Insumo } from './insumo.entity.js';
import { RegistroSanitario } from './registro_sanitario.entity.js';

/** Lo que se puede corregir de un lote después de creado. */
export interface CambiosLote {
  fechaFabricacion?: string | null;
  fechaVencimiento?: string | null;
  fabricante?: string | null;
  proveedor?: string | null;
  documentoSoporte?: string | null;
  observaciones?: string | null;
}

export interface DatosLote extends Required<CambiosLote> {
  numeroLote: string;
  recibidoEn: Date | null;
}

export interface PropiedadesLote extends DatosLote {
  id: string;
  insumoId: string;
  registroSanitarioId: string | null;
  creadoEn: Date;
  /** Solo lectura. */
  insumoNombre: string | null;
  requiereVencimiento: boolean;
}

export class Lote {
  private constructor(private readonly propiedades: PropiedadesLote) {}

  static crear(
    insumo: Insumo,
    registro: RegistroSanitario | null,
    datos: DatosLote,
    ahora: Date,
    hoy: string,
  ): Lote {
    insumo.exigirActivo();
    if (insumo.control !== 'lote') {
      throw new ReglaNegocioError(`"${insumo.nombre}" no se controla por lote`);
    }
    RegistroSanitario.exigirParaInsumo(insumo, registro, hoy);
    return new Lote({
      ...Lote.validar(datos, insumo.requiereVencimiento, hoy),
      numeroLote: textoObligatorio(datos.numeroLote, 'El número de lote', 100),
      recibidoEn: datos.recibidoEn
        ? noEnElFuturo(datos.recibidoEn, ahora, 'La fecha de recibido')
        : null,
      id: crypto.randomUUID(),
      insumoId: insumo.id,
      registroSanitarioId: registro?.id ?? null,
      creadoEn: ahora,
      insumoNombre: insumo.nombre,
      requiereVencimiento: insumo.requiereVencimiento,
    });
  }

  static reconstruir(propiedades: PropiedadesLote): Lote {
    return new Lote({ ...propiedades });
  }

  get id(): string {
    return this.propiedades.id;
  }
  get insumoId(): string {
    return this.propiedades.insumoId;
  }
  get registroSanitarioId(): string | null {
    return this.propiedades.registroSanitarioId;
  }
  get numeroLote(): string {
    return this.propiedades.numeroLote;
  }
  get fechaFabricacion(): string | null {
    return this.propiedades.fechaFabricacion;
  }
  get fechaVencimiento(): string | null {
    return this.propiedades.fechaVencimiento;
  }
  get fabricante(): string | null {
    return this.propiedades.fabricante;
  }
  get proveedor(): string | null {
    return this.propiedades.proveedor;
  }
  get recibidoEn(): Date | null {
    return this.propiedades.recibidoEn;
  }
  get documentoSoporte(): string | null {
    return this.propiedades.documentoSoporte;
  }
  get observaciones(): string | null {
    return this.propiedades.observaciones;
  }
  get creadoEn(): Date {
    return this.propiedades.creadoEn;
  }
  get insumoNombre(): string | null {
    return this.propiedades.insumoNombre;
  }

  /** Vence al terminar el día indicado: el mismo día todavía sirve. */
  estaVencido(hoy: string): boolean {
    const { fechaVencimiento } = this.propiedades;
    return fechaVencimiento !== null && fechaVencimiento < hoy;
  }

  actualizar(cambios: CambiosLote, hoy: string): void {
    const actual: Required<CambiosLote> = {
      fechaFabricacion: this.propiedades.fechaFabricacion,
      fechaVencimiento: this.propiedades.fechaVencimiento,
      fabricante: this.propiedades.fabricante,
      proveedor: this.propiedades.proveedor,
      documentoSoporte: this.propiedades.documentoSoporte,
      observaciones: this.propiedades.observaciones,
    };
    Object.assign(
      this.propiedades,
      Lote.validar(
        fusionarDefinidos(actual, cambios),
        this.propiedades.requiereVencimiento,
        hoy,
      ),
    );
  }

  private static validar(
    datos: Required<CambiosLote>,
    requiereVencimiento: boolean,
    hoy: string,
  ): Required<CambiosLote> {
    const fechaFabricacion = fechaOpcional(
      datos.fechaFabricacion,
      'La fecha de fabricación',
    );
    const fechaVencimiento = fechaOpcional(
      datos.fechaVencimiento,
      'La fecha de vencimiento',
    );
    if (requiereVencimiento && !fechaVencimiento) {
      throw new ReglaNegocioError('Este insumo exige fecha de vencimiento');
    }
    exigirOrden(
      fechaFabricacion,
      hoy,
      'La fecha de fabricación no puede estar en el futuro',
    );
    exigirOrden(
      fechaFabricacion,
      fechaVencimiento,
      'El lote no puede vencer antes de fabricarse',
    );
    return {
      fechaFabricacion,
      fechaVencimiento,
      fabricante: textoOpcional(datos.fabricante, 'El fabricante', 150),
      proveedor: textoOpcional(datos.proveedor, 'El proveedor', 150),
      documentoSoporte: textoOpcional(
        datos.documentoSoporte,
        'El documento soporte',
        500,
      ),
      observaciones: textoOpcional(
        datos.observaciones,
        'Las observaciones',
        5000,
      ),
    };
  }
}
