import { Roles } from '../../../../../common/constants/roles.js';
import { ReglaNegocioError } from '../../../../../common/exceptions/errores_dominio.js';
import { crearTurnoPrueba } from '../../../../../../test/dobles/turnos_memoria.js';
import { Turno } from '../../../domain/entities/turno.entity.js';

describe('Turno', () => {
  it('inicia activo con su tripulación', () => {
    const turno = crearTurnoPrueba('amb-1');

    expect(turno.estaActivo()).toBe(true);
    expect(turno.incluyeA('conductor-1')).toBe(true);
    expect(turno.fin).toBeNull();
  });

  it('exige un conductor y alguien que atienda al paciente', () => {
    expect(() =>
      crearTurnoPrueba('amb-1', [
        { usuarioId: 'p1', funcion: 'paramedico' },
        { usuarioId: 'p2', funcion: 'medico' },
      ]),
    ).toThrow(ReglaNegocioError);
    expect(() =>
      crearTurnoPrueba('amb-1', [{ usuarioId: 'c1', funcion: 'conductor' }]),
    ).toThrow(ReglaNegocioError);
  });

  it('no deja repetir a una persona', () => {
    expect(() =>
      crearTurnoPrueba('amb-1', [
        { usuarioId: 'c1', funcion: 'conductor' },
        { usuarioId: 'c1', funcion: 'paramedico' },
      ]),
    ).toThrow(ReglaNegocioError);
  });

  it('relaciona la función con el rol', () => {
    expect(Turno.puedeCumplir(Roles.CONDUCTOR, 'conductor')).toBe(true);
    expect(Turno.puedeCumplir(Roles.PARAMEDICO, 'medico')).toBe(true);
    expect(Turno.puedeCumplir(Roles.CONDUCTOR, 'paramedico')).toBe(false);
    expect(Turno.puedeCumplir(Roles.DESPACHADOR, 'conductor')).toBe(false);
  });

  it('una vez finalizado no se modifica', () => {
    const turno = crearTurnoPrueba('amb-1');
    turno.finalizar(new Date());

    expect(turno.estado).toBe('finalizado');
    expect(() => turno.finalizar(new Date())).toThrow(ReglaNegocioError);
    expect(() =>
      turno.reemplazarIntegrantes([
        { usuarioId: 'c2', funcion: 'conductor' },
        { usuarioId: 'p2', funcion: 'paramedico' },
      ]),
    ).toThrow(ReglaNegocioError);
  });
});
