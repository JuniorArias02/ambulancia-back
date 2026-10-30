import { ReglaNegocioError } from '../../../../../common/exceptions/errores_dominio.js';
import { crearEmergenciaPrueba } from '../../../../../../test/dobles/emergencias_memoria.js';
import { Emergencia } from '../../../domain/entities/emergencia.entity.js';

describe('Emergencia', () => {
  it('nace recibida, limpia los textos y vacíos quedan en null', () => {
    const emergencia = crearEmergenciaPrueba({
      descripcion: '  Persona caída  ',
      informanteNombre: '   ',
      direccion: ' Calle 10 ',
    });

    expect(emergencia.estado).toBe('recibida');
    expect(emergencia.descripcion).toBe('Persona caída');
    expect(emergencia.informanteNombre).toBeNull();
    expect(emergencia.direccion).toBe('Calle 10');
    expect(emergencia.estaActiva()).toBe(true);
  });

  it('exige dirección o coordenadas', () => {
    expect(() => crearEmergenciaPrueba({ direccion: null })).toThrow(
      ReglaNegocioError,
    );
    expect(
      crearEmergenciaPrueba({
        direccion: null,
        latitud: 4.65,
        longitud: -74.05,
      }).coordenadas,
    ).toEqual({ latitud: 4.65, longitud: -74.05 });
  });

  it('exige latitud y longitud juntas', () => {
    expect(() => crearEmergenciaPrueba({ latitud: 4.65 })).toThrow(
      ReglaNegocioError,
    );
  });

  it('arma el número con la fecha de Colombia', () => {
    // 03:00 UTC del 25 es todavía el 24 en Bogotá (UTC-5).
    const fecha = new Date('2026-10-25T03:00:00Z');
    expect(Emergencia.formatearNumero(fecha, 7)).toBe('EMG-20261024-0007');
  });

  it('solo cancela una emergencia recibida', () => {
    const emergencia = crearEmergenciaPrueba();
    emergencia.cancelar(new Date());

    expect(emergencia.estado).toBe('cancelada');
    expect(emergencia.cerradaEn).not.toBeNull();
    expect(() => emergencia.cancelar(new Date())).toThrow(ReglaNegocioError);
    expect(() => emergencia.actualizarDatos({ prioridad: 'roja' })).toThrow(
      ReglaNegocioError,
    );
  });

  it('marca duplicada apuntando a la principal', () => {
    const principal = crearEmergenciaPrueba();
    const repetida = crearEmergenciaPrueba();

    repetida.marcarDuplicadaDe(principal, new Date());

    expect(repetida.estado).toBe('cancelada');
    expect(repetida.emergenciaPrincipalId).toBe(principal.id);
  });

  it('no deja marcar duplicada de sí misma ni de otra duplicada', () => {
    const principal = crearEmergenciaPrueba();
    const repetida = crearEmergenciaPrueba();
    const otra = crearEmergenciaPrueba();
    repetida.marcarDuplicadaDe(principal, new Date());

    expect(() => otra.marcarDuplicadaDe(otra, new Date())).toThrow(
      ReglaNegocioError,
    );
    expect(() => otra.marcarDuplicadaDe(repetida, new Date())).toThrow(
      ReglaNegocioError,
    );
  });
});
