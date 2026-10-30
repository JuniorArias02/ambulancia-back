import {
  ClienteGeoapify,
  esObjeto,
  texto,
} from '../../../../common/integrations/geoapify/cliente_geoapify.js';
import {
  distanciaMetros,
  type PuntoGeografico,
} from '../../../../common/utils/geografia.js';
import {
  type ConsultaGeocodificacion,
  ProveedorGeocodificacion,
  type ResultadoInversoProveedor,
  type ResultadoProveedor,
} from '../../domain/services/proveedor_geocodificacion.js';

export interface OpcionesGeoapify {
  apiKey: string | null;
  /** Código ISO de 2 letras; null para no restringir. */
  pais: string | null;
  confianzaMinima: number;
  tiempoEsperaMs: number;
}

const MAXIMO_CANDIDATOS = 5;

/**
 * Geoapify interpreta "# 15-20" como parte del nombre y termina devolviendo
 * solo la calle. Sin el símbolo, reconoce la placa ("Calle 72 15-20").
 */
function textoParaGeoapify(direccion: string): string {
  return direccion
    .replace(/(#|\bn[°º]\.?|\bnro\.?|\bno\.)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Solo se aceptan resultados con precisión de calle o mejor: una ambulancia
 * no puede ir "a Bogotá" o "a un barrio". `result_type` según la API de Geoapify.
 */
const TIPOS_CONFIABLES: ReadonlySet<string> = new Set([
  'building',
  'amenity',
  'street',
]);

interface ResultadoGeoapify {
  lat: number;
  lon: number;
  formatted: string | null;
  addressLine1: string | null;
  placeId: string | null;
  resultType: string | null;
  countryCode: string | null;
  confianza: number | null;
  street: string | null;
  housenumber: string | null;
  barrio: string | null;
  ciudad: string | null;
  departamento: string | null;
  codigoPostal: string | null;
}

export class GeoapifyProveedor extends ProveedorGeocodificacion {
  readonly nombre = 'geoapify';
  private readonly cliente: ClienteGeoapify;

  constructor(private readonly opciones: OpcionesGeoapify) {
    super();
    this.cliente = new ClienteGeoapify({
      apiKey: opciones.apiKey,
      tiempoEsperaMs: opciones.tiempoEsperaMs,
    });
  }

  estaConfigurado(): boolean {
    return this.cliente.estaConfigurado();
  }

  async geocodificar(
    consulta: ConsultaGeocodificacion,
  ): Promise<ResultadoProveedor> {
    const parametros = new URLSearchParams({
      text: [textoParaGeoapify(consulta.direccion), consulta.ciudad]
        .filter(Boolean)
        .join(', '),
      limit: String(MAXIMO_CANDIDATOS),
    });
    if (this.opciones.pais) {
      parametros.set('filter', `countrycode:${this.opciones.pais}`);
    }

    const resultados = await this.solicitar('search', parametros);
    return {
      candidatos: resultados
        .filter((resultado) => this.esConfiable(resultado))
        .map((resultado) => ({
          latitud: resultado.lat,
          longitud: resultado.lon,
          direccionFormateada: resultado.formatted,
          proveedorResultadoId: resultado.placeId,
          confianza: resultado.confianza,
        })),
    };
  }

  async geocodificarInverso(
    punto: PuntoGeografico,
  ): Promise<ResultadoInversoProveedor> {
    const resultados = await this.solicitar(
      'reverse',
      new URLSearchParams({
        lat: String(punto.latitud),
        lon: String(punto.longitud),
      }),
    );
    const cercano = resultados[0];
    if (!cercano || !this.esDelPais(cercano)) return { lugar: null };

    return {
      lugar: {
        direccionFormateada: cercano.formatted,
        lineaDireccion: cercano.addressLine1,
        componentes: {
          calle: cercano.street,
          numero: cercano.housenumber,
          barrio: cercano.barrio,
          ciudad: cercano.ciudad,
          departamento: cercano.departamento,
          codigoPostal: cercano.codigoPostal,
          pais: cercano.countryCode?.toLowerCase() ?? null,
        },
        coordenadas: { latitud: cercano.lat, longitud: cercano.lon },
        // Se calcula aquí en vez de usar el `distance` de Geoapify: así no
        // depende de un campo que el proveedor podría omitir.
        distanciaMetros: distanciaMetros(punto, {
          latitud: cercano.lat,
          longitud: cercano.lon,
        }),
        proveedorResultadoId: cercano.placeId,
      },
    };
  }

  /** Parámetros comunes de la geocodificación de Geoapify. */
  private async solicitar(
    ruta: 'search' | 'reverse',
    parametros: URLSearchParams,
  ): Promise<ResultadoGeoapify[]> {
    parametros.set('format', 'json');
    parametros.set('lang', 'es');
    return this.leerResultados(
      await this.cliente.obtener(`geocode/${ruta}`, parametros),
    );
  }

  private esConfiable(resultado: ResultadoGeoapify): boolean {
    if (!resultado.resultType || !TIPOS_CONFIABLES.has(resultado.resultType)) {
      return false;
    }
    if (
      resultado.confianza === null ||
      resultado.confianza < this.opciones.confianzaMinima
    ) {
      return false;
    }
    return this.esDelPais(resultado);
  }

  private esDelPais(resultado: ResultadoGeoapify): boolean {
    return (
      !this.opciones.pais ||
      resultado.countryCode?.toLowerCase() === this.opciones.pais
    );
  }

  /** Valida la forma de la respuesta sin confiar en ella (`unknown` → tipos propios). */
  private leerResultados(cuerpo: unknown): ResultadoGeoapify[] {
    if (!esObjeto(cuerpo) || !Array.isArray(cuerpo['results'])) {
      throw this.cliente.falla('respuesta_invalida', 'Falta "results"');
    }
    return cuerpo['results'].flatMap((item: unknown) => {
      if (!esObjeto(item)) return [];
      const { lat, lon } = item;
      if (typeof lat !== 'number' || typeof lon !== 'number') return [];
      const rank = esObjeto(item['rank']) ? item['rank'] : {};
      return [
        {
          lat,
          lon,
          formatted: texto(item['formatted']),
          addressLine1: texto(item['address_line1']),
          placeId: texto(item['place_id']),
          resultType: texto(item['result_type']),
          countryCode: texto(item['country_code']),
          confianza:
            typeof rank['confidence'] === 'number' ? rank['confidence'] : null,
          street: texto(item['street']),
          housenumber: texto(item['housenumber']),
          barrio: texto(item['suburb']) ?? texto(item['district']),
          ciudad: texto(item['city']) ?? texto(item['county']),
          departamento: texto(item['state']),
          codigoPostal: texto(item['postcode']),
        },
      ];
    });
  }
}
