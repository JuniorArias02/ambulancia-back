import {
  TurnosMemoria,
  crearTurnoPrueba,
} from '../../../../../../test/dobles/turnos_memoria.js';
import {
  AccesoDenegadoError,
  NoAutenticadoError,
  ReglaNegocioError,
} from '../../../../../common/exceptions/errores_dominio.js';
import { UbicacionDelParamedico } from '../../../application/services/ubicacion_del_paramedico.service.js';
import { UbicacionesMemoria } from '../../dobles/ubicaciones_memoria.js';

describe('UbicacionDelParamedico', () => {
  let turnos: TurnosMemoria;
  let ubicaciones: UbicacionesMemoria;
  let servicio: UbicacionDelParamedico;

  beforeEach(async () => {
    turnos = new TurnosMemoria();
    ubicaciones = new UbicacionesMemoria();
    servicio = new UbicacionDelParamedico(turnos, ubicaciones);
    await turnos.crear(crearTurnoPrueba('amb-1'));
  });

  it('usa la ambulancia del turno y la habilita la primera vez (una sola vez)', async () => {
    const primera = await servicio.obtener('paramedico-1');
    const segunda = await servicio.obtener('paramedico-1');
    expect(primera.ambulanciaId).toBe('amb-1');
    expect(primera.ubicacion.ambulanciaId).toBe('amb-1');
    expect(segunda.ubicacion.id).toBe(primera.ubicacion.id);
    expect(ubicaciones.ubicaciones.size).toBe(1);
  });

  it('rechaza sin sesión, sin turno o si no es el paramédico del turno', async () => {
    await expect(servicio.obtener(null)).rejects.toThrow(NoAutenticadoError);
    await expect(servicio.obtener('paramedico-sin-turno')).rejects.toThrow(
      ReglaNegocioError,
    );
    await expect(servicio.obtener('conductor-1')).rejects.toThrow(
      AccesoDenegadoError,
    );
  });

  it('no deja operar un inventario desactivado', async () => {
    const { ubicacion } = await servicio.obtener('paramedico-1');
    ubicacion.cambiarEstado(false);
    await expect(servicio.obtener('paramedico-1')).rejects.toThrow(/inactiva/);
  });
});
