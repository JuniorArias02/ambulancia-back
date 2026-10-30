import { ReglaNegocioError } from '../../../../../common/exceptions/errores_dominio.js';
import { HistoriaClinica } from '../../../domain/entities/historia_clinica.entity.js';

function nueva() {
  return HistoriaClinica.abrir({
    id: 'h1',
    numeroHistoria: 'HC-20261025-0001',
    emergenciaId: 'e1',
    asignacionId: 'a1',
    creadaPorId: 'paramedico-1',
    abiertaEn: new Date(),
    sincronizadaEn: new Date(),
  });
}

describe('HistoriaClinica', () => {
  it('nace en borrador, con el paciente como NN', () => {
    const historia = nueva();
    expect(historia.estado).toBe('borrador');
    expect(historia.datos.pacienteIdentificado).toBe(false);
  });

  it('normaliza textos, documento y placa; null borra un dato', () => {
    const historia = nueva();
    historia.actualizar({
      nombres: '  Juan ',
      numeroDocumento: '1.098-765 432',
      placaVehiculo: 'abc 12d',
      alergias: '   ',
    });
    expect(historia.datos.nombres).toBe('Juan');
    expect(historia.datos.numeroDocumento).toBe('1098765432');
    expect(historia.datos.placaVehiculo).toBe('ABC12D');
    expect(historia.datos.alergias).toBeNull();

    historia.actualizar({ nombres: null, apellidos: undefined });
    expect(historia.datos.nombres).toBeNull();
  });

  it('dice qué falta para cerrar', () => {
    const historia = nueva();
    historia.actualizar({
      pacienteIdentificado: true,
      desenlace: 'trasladado',
    });

    expect(historia.faltantesParaCerrar({ signosVitales: 0 })).toEqual([
      'triage',
      'nombres o número de documento del paciente identificado',
      'institución de destino',
      'nombre de quien recibe al paciente',
      'al menos una toma de signos vitales',
    ]);
  });

  it('el rechazo del traslado exige el motivo; el fallecido no exige signos vitales', () => {
    const rechazo = nueva();
    rechazo.actualizar({ triage: 'verde', desenlace: 'rechazo_traslado' });
    expect(rechazo.faltantesParaCerrar({ signosVitales: 1 })).toEqual([
      'motivo del rechazo del traslado',
    ]);

    const fallecido = nueva();
    fallecido.actualizar({ triage: 'negro', desenlace: 'fallecido_en_sitio' });
    expect(fallecido.faltantesParaCerrar({ signosVitales: 0 })).toEqual([]);
  });

  it('no cierra incompleta; completa queda sellada y ya no se edita', () => {
    const historia = nueva();
    const cerrar = () =>
      historia.cerrar({
        cerradaPorId: 'p1',
        fecha: new Date(),
        hash: 'abc',
        registros: { signosVitales: 1 },
      });
    expect(cerrar).toThrow(/Para cerrar la historia falta: triage, desenlace/);

    historia.actualizar({
      triage: 'amarillo',
      desenlace: 'trasladado',
      institucionDestinoId: 'i1',
      receptorNombre: 'Dra. Gómez',
    });
    cerrar();

    expect(historia.estado).toBe('cerrada');
    expect(historia.hashCierre).toBe('abc');
    expect(historia.datos.entregadoEn).not.toBeNull();
    expect(() => historia.actualizar({ observaciones: 'algo' })).toThrow(
      ReglaNegocioError,
    );
  });

  it('se anula una sola vez, sin borrar el contenido', () => {
    const historia = nueva();
    historia.actualizar({ nombres: 'Juan' });
    historia.anular();
    expect(historia.estado).toBe('anulada');
    expect(historia.datos.nombres).toBe('Juan');
    expect(() => historia.anular()).toThrow(ReglaNegocioError);
  });

  it('el número tiene el formato HC-AAAAMMDD-NNNN', () => {
    expect(HistoriaClinica.formatearNumero('20261025', 7)).toBe(
      'HC-20261025-0007',
    );
  });
});
