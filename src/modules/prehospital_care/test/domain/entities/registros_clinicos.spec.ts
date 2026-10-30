import { ReglaNegocioError } from '../../../../../common/exceptions/errores_dominio.js';
import {
  crearIntervencion,
  crearSignoVital,
  type MedicionesSignoVital,
} from '../../../domain/entities/registros_clinicos.js';

const SIN_MEDICIONES: MedicionesSignoVital = {
  presionSistolica: null,
  presionDiastolica: null,
  frecuenciaCardiaca: null,
  frecuenciaRespiratoria: null,
  saturacionOxigeno: null,
  temperatura: null,
  glucometria: null,
  glasgowOcular: null,
  glasgowVerbal: null,
  glasgowMotor: null,
  escalaDolor: null,
};

function signo(mediciones: Partial<MedicionesSignoVital>) {
  return crearSignoVital({
    id: 's1',
    historiaClinicaId: 'h1',
    medidoEn: new Date(),
    mediciones: { ...SIN_MEDICIONES, ...mediciones },
    registradoPorId: 'p1',
  });
}

describe('Registros clínicos', () => {
  it('calcula el Glasgow total solo con las tres partes', () => {
    expect(
      signo({ glasgowOcular: 4, glasgowVerbal: 5, glasgowMotor: 6 })
        .glasgowTotal,
    ).toBe(15);
    expect(
      signo({ glasgowOcular: 3, glasgowVerbal: 4 }).glasgowTotal,
    ).toBeNull();
  });

  it('exige al menos una medición', () => {
    expect(() => signo({})).toThrow('Registre al menos una medición');
  });

  it('rechaza una diastólica mayor o igual que la sistólica (error de digitación)', () => {
    expect(() =>
      signo({ presionSistolica: 80, presionDiastolica: 120 }),
    ).toThrow(ReglaNegocioError);
  });

  it('la intervención exige nombre y limpia los opcionales', () => {
    const intervencion = crearIntervencion({
      id: 'i1',
      historiaClinicaId: 'h1',
      tipo: 'medicamento',
      nombre: ' SSN 0.9% ',
      dosis: '  ',
      registradoPorId: 'p1',
    });
    expect(intervencion.nombre).toBe('SSN 0.9%');
    expect(intervencion.dosis).toBeNull();
  });
});
