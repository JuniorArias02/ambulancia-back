import { ReglaNegocioError } from '../../../../../common/exceptions/errores_dominio.js';
import { Asignacion } from '../../../domain/entities/asignacion.entity.js';

function nuevaAsignacion(): Asignacion {
  return Asignacion.crear({
    emergenciaId: 'e1',
    ambulanciaId: 'a1',
    turnoId: 't1',
    asignadaPorId: 'despachador-1',
    asignadaEn: new Date(),
  });
}

describe('Asignacion', () => {
  it('avanza en orden y guarda la hora de cada paso', () => {
    const asignacion = nuevaAsignacion();

    asignacion.avanzar('en_camino', new Date());
    asignacion.avanzar('en_escena', new Date());
    asignacion.avanzar('atendiendo', new Date());
    asignacion.avanzar('trasladando', new Date());
    asignacion.avanzar('finalizada', new Date());

    expect(asignacion.estado).toBe('finalizada');
    expect(asignacion.salidaEn).not.toBeNull();
    expect(asignacion.llegadaEscenaEn).not.toBeNull();
    expect(asignacion.salidaEscenaEn).not.toBeNull();
    expect(asignacion.llegadaDestinoEn).not.toBeNull();
    expect(asignacion.estaActiva()).toBe(false);
  });

  it('puede finalizar en la escena sin trasladar', () => {
    const asignacion = nuevaAsignacion();
    asignacion.avanzar('en_camino', new Date());
    asignacion.avanzar('en_escena', new Date());
    asignacion.avanzar('finalizada', new Date());

    expect(asignacion.llegadaDestinoEn).toBeNull();
    expect(asignacion.finalizadaEn).not.toBeNull();
  });

  it('no deja saltarse pasos', () => {
    expect(() => nuevaAsignacion().avanzar('en_escena', new Date())).toThrow(
      ReglaNegocioError,
    );
    expect(Asignacion.siguientesEstados('en_escena')).toEqual([
      'atendiendo',
      'finalizada',
    ]);
  });

  it('solo se cancela antes de llegar a la escena', () => {
    const enCamino = nuevaAsignacion();
    enCamino.avanzar('en_camino', new Date());
    enCamino.cancelar('Se envía una más cercana', new Date());
    expect(enCamino.estado).toBe('cancelada');

    const enEscena = nuevaAsignacion();
    enEscena.avanzar('en_camino', new Date());
    enEscena.avanzar('en_escena', new Date());
    expect(() => enEscena.cancelar('Motivo', new Date())).toThrow(
      ReglaNegocioError,
    );
  });

  it('la atención va entre la llegada y el traslado, y guarda su hora', () => {
    const asignacion = nuevaAsignacion();
    asignacion.avanzar('en_camino', new Date());
    asignacion.avanzar('en_escena', new Date());

    expect(Asignacion.siguientesEstados('en_escena')).toEqual([
      'atendiendo',
      'finalizada',
    ]);
    asignacion.avanzar('atendiendo', new Date());
    expect(asignacion.atencionInicioEn).not.toBeNull();
    expect(Asignacion.siguientesEstados('atendiendo')).toEqual([
      'trasladando',
      'finalizada',
    ]);
  });

  it('cerrar sin haber trasladado requiere motivo; después del traslado no', () => {
    const asignacion = nuevaAsignacion();
    asignacion.avanzar('en_camino', new Date());
    asignacion.avanzar('en_escena', new Date());
    expect(asignacion.cierreRequiereMotivo('finalizada')).toBe(true);

    asignacion.avanzar('atendiendo', new Date());
    asignacion.avanzar('trasladando', new Date());
    expect(asignacion.cierreRequiereMotivo('finalizada')).toBe(false);
  });
});
