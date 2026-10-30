import {
  claveGeocodificacion,
  coincideNomenclatura,
  normalizarDireccion,
  nucleoNomenclatura,
} from '../../../domain/services/normalizador_direcciones.js';

describe('normalizarDireccion', () => {
  it('trata igual las formas comunes de escribir una dirección', () => {
    const esperado = 'calle 72 15 20';
    expect(normalizarDireccion('Calle 72 # 15-20')).toBe(esperado);
    expect(normalizarDireccion('Cl. 72 #15-20')).toBe(esperado);
    expect(normalizarDireccion('CLL 72 No. 15 - 20')).toBe(esperado);
    expect(normalizarDireccion('cl72 n° 15-20')).toBe(esperado);
    expect(normalizarDireccion('  calle   72  nro 15-20 ')).toBe(esperado);
  });

  it('unifica las abreviaturas de vías y quita tildes', () => {
    expect(normalizarDireccion('Kra 7 # 40-62')).toBe('carrera 7 40 62');
    expect(normalizarDireccion('Av. Boyacá # 80-94')).toBe(
      'avenida boyaca 80 94',
    );
    expect(normalizarDireccion('AK 68 # 24-10')).toBe(
      'avenida carrera 68 24 10',
    );
    expect(normalizarDireccion('Dg 40A Sur # 3-21')).toBe(
      'diagonal 40a sur 3 21',
    );
    expect(normalizarDireccion('Tv. 93 # 51-98')).toBe('transversal 93 51 98');
  });

  it('no confunde palabras que solo empiezan como una abreviatura', () => {
    expect(normalizarDireccion('Clínica del Country')).toBe(
      'clinica del country',
    );
  });
});

describe('claveGeocodificacion', () => {
  it('incluye país y ciudad: la misma dirección en otra ciudad es otra clave', () => {
    const bogota = claveGeocodificacion({
      direccion: 'Calle 10 # 5-20',
      ciudad: 'Bogotá',
      pais: 'co',
    });
    const cali = claveGeocodificacion({
      direccion: 'Calle 10 # 5-20',
      ciudad: 'Cali',
      pais: 'co',
    });
    expect(bogota).toBe('co|bogota|calle 10 5 20');
    expect(cali).not.toBe(bogota);
  });

  it('sin ciudad deja ese segmento vacío', () => {
    expect(
      claveGeocodificacion({ direccion: 'Cl 1', ciudad: null, pais: 'co' }),
    ).toBe('co||calle 1');
  });
});

describe('nucleoNomenclatura', () => {
  it('se queda con vía, número, cruce y placa', () => {
    expect(nucleoNomenclatura('Calle 72 # 15-20 apto 301')).toBe(
      'calle 72 15 20',
    );
    expect(nucleoNomenclatura('Cl 40 Sur # 3A-21')).toBe('calle 40 sur 3a 21');
    expect(nucleoNomenclatura('Calle 72 A # 15-20')).toBe('calle 72a 15 20');
    expect(nucleoNomenclatura('AC 26 # 69-76')).toBe('avenida calle 26 69 76');
  });

  it('devuelve null si no es nomenclatura', () => {
    expect(nucleoNomenclatura('Hospital San Ignacio')).toBeNull();
    expect(nucleoNomenclatura('Calle 72')).toBeNull();
  });
});

describe('coincideNomenclatura', () => {
  it('acepta la misma dirección escrita por el proveedor a su manera', () => {
    expect(
      coincideNomenclatura(
        'Calle 72 # 15-20',
        'Cl 72 15-20, Chapinero, Bogotá, Colombia',
      ),
    ).toBe(true);
    expect(
      coincideNomenclatura('Kra 7 # 40-62', 'Carrera 7 #40-62, Bogotá'),
    ).toBe(true);
  });

  it('rechaza una dirección parecida pero distinta (caso real de Geoapify)', () => {
    expect(
      coincideNomenclatura(
        'Calle 72 # 15-20',
        'Cl 72 S 15A 20 E, 110521 Bogotá, DC, Colombia',
      ),
    ).toBe(false);
    expect(
      coincideNomenclatura('Calle 72 # 15-20', 'Calle 72, Engativá, Bogotá'),
    ).toBe(false);
  });

  it('sin dirección formateada no se puede verificar', () => {
    expect(coincideNomenclatura('Calle 72 # 15-20', null)).toBe(false);
  });

  it('si lo pedido no es nomenclatura, no se compara', () => {
    expect(
      coincideNomenclatura(
        'Hospital San Ignacio',
        'Hospital Universitario San Ignacio',
      ),
    ).toBe(true);
  });
});
