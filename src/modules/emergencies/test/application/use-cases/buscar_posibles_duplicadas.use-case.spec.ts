import {
  EmergenciasMemoria,
  crearEmergenciaPrueba,
} from '../../../../../../test/dobles/emergencias_memoria.js';
import { BuscarPosiblesDuplicadas } from '../../../application/use-cases/buscar_posibles_duplicadas.use-case.js';

describe('BuscarPosiblesDuplicadas', () => {
  let emergencias: EmergenciasMemoria;
  let buscar: BuscarPosiblesDuplicadas;

  beforeEach(() => {
    emergencias = new EmergenciasMemoria();
    buscar = new BuscarPosiblesDuplicadas(emergencias);
  });

  async function guardar(cambios: Parameters<typeof crearEmergenciaPrueba>[0]) {
    return emergencias.crear(crearEmergenciaPrueba(cambios));
  }

  it('sugiere las cercanas y las de la misma dirección, de la más cercana a la más lejana', async () => {
    const base = await guardar({ latitud: 4.6582, longitud: -74.0571 });
    // ~110 m al norte
    const cercana = await guardar({ latitud: 4.6592, longitud: -74.0571 });
    // ~11 km: no es cercana, pero comparte dirección (escrita distinto)
    const mismaDireccion = await guardar({
      direccion: 'calle 72 #15 20',
      latitud: 4.7582,
      longitud: -74.0571,
    });
    await guardar({
      direccion: 'Carrera 7 # 100',
      latitud: 4.7582,
      longitud: -74.0571,
    });

    const posibles = await buscar.ejecutar(base.id);

    expect(posibles.map((p) => p.emergencia.id)).toEqual([
      cercana.id,
      mismaDireccion.id,
    ]);
    expect(posibles[0]?.criterios).toEqual([
      'cercania',
      'misma_direccion',
      'mismo_tipo',
    ]);
    expect(posibles[0]?.distanciaMetros).toBeGreaterThan(100);
    expect(posibles[0]?.distanciaMetros).toBeLessThan(120);
  });

  it('no sugiere emergencias canceladas', async () => {
    const base = await guardar({});
    const cancelada = await guardar({});
    cancelada.cancelar(new Date());

    expect(await buscar.ejecutar(base.id)).toEqual([]);
  });
});
