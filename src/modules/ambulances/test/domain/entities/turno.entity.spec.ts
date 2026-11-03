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

  it('puede iniciar con una sola persona, pero aún no está completo', () => {
    const turno = crearTurnoPrueba('amb-1', [
      { usuarioId: 'c1', funcion: 'conductor' },
    ]);

    expect(turno.tieneTripulacionCompleta()).toBe(false);
    turno.agregarIntegrante({ usuarioId: 'p1', funcion: 'paramedico' });
    expect(turno.tieneTripulacionCompleta()).toBe(true);
  });

  it('no admite dos conductores, ni un turno vacío, ni pasar el máximo', () => {
    const conConductor = crearTurnoPrueba('amb-1', [
      { usuarioId: 'c1', funcion: 'conductor' },
    ]);
    expect(() =>
      conConductor.agregarIntegrante({ usuarioId: 'c2', funcion: 'conductor' }),
    ).toThrow(ReglaNegocioError);
    expect(() => crearTurnoPrueba('amb-1', [])).toThrow(ReglaNegocioError);
    expect(() =>
      crearTurnoPrueba(
        'amb-1',
        ['p1', 'p2', 'p3', 'p4', 'p5'].map((usuarioId) => ({
          usuarioId,
          funcion: 'paramedico' as const,
        })),
      ),
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

  it('la función sale del rol', () => {
    expect(Turno.funcionDelRol(Roles.CONDUCTOR)).toBe('conductor');
    expect(Turno.funcionDelRol(Roles.PARAMEDICO)).toBe('paramedico');
    expect(Turno.funcionDelRol(Roles.DESPACHADOR)).toBeNull();
  });

  it('una vez finalizado no se modifica', () => {
    const turno = crearTurnoPrueba('amb-1');
    turno.finalizar(new Date());

    expect(turno.estado).toBe('finalizado');
    expect(() => turno.finalizar(new Date())).toThrow(ReglaNegocioError);
    expect(() =>
      turno.agregarIntegrante({ usuarioId: 'p2', funcion: 'paramedico' }),
    ).toThrow(ReglaNegocioError);
  });
});
