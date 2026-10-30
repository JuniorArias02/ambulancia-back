import { ReglaNegocioError } from '../../../../../common/exceptions/errores_dominio.js';
import { Ambulancia } from '../../../domain/entities/ambulancia.entity.js';

describe('Ambulancia', () => {
  const tipo = { id: 't1', nombre: 'TAB', descripcion: null };

  it('normaliza código y placa y nace fuera de servicio', () => {
    const ambulancia = Ambulancia.crear({
      codigo: ' amb-01 ',
      placa: 'abc 123',
      tipo,
    });

    expect(ambulancia.codigo).toBe('AMB-01');
    expect(ambulancia.placa).toBe('ABC123');
    expect(ambulancia.estadoOperativo).toBe('fuera_servicio');
    expect(ambulancia.estaDisponible()).toBe(false);
  });

  it('permite las transiciones manuales válidas', () => {
    const ambulancia = Ambulancia.crear({
      codigo: 'A1',
      placa: 'ABC123',
      tipo,
    });

    ambulancia.cambiarEstadoManual('disponible');
    expect(ambulancia.estaDisponible()).toBe(true);

    ambulancia.cambiarEstadoManual('mantenimiento');
    expect(ambulancia.estadoOperativo).toBe('mantenimiento');
  });

  it('rechaza cambiar al mismo estado', () => {
    const ambulancia = Ambulancia.crear({
      codigo: 'A1',
      placa: 'ABC123',
      tipo,
    });

    expect(() => ambulancia.cambiarEstadoManual('fuera_servicio')).toThrow(
      ReglaNegocioError,
    );
  });

  it('no deja cambiar a mano ni editar una ambulancia en servicio', () => {
    const ambulancia = Ambulancia.reconstruir({
      id: 'a1',
      codigo: 'A1',
      placa: 'ABC123',
      tipo,
      estadoOperativo: 'en_servicio',
      ultimaUbicacion: null,
      creadaEn: new Date(),
    });

    expect(() => ambulancia.cambiarEstadoManual('disponible')).toThrow(
      ReglaNegocioError,
    );
    expect(() => ambulancia.actualizarDatos({ placa: 'XYZ987' })).toThrow(
      ReglaNegocioError,
    );
  });
});
