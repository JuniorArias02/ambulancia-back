import 'reflect-metadata';
import { validarVariablesEntorno } from '../variables_entorno.js';

describe('validarVariablesEntorno', () => {
  const base = {
    NODE_ENV: 'test',
    PUERTO: '3000',
    CORS_ORIGENES: 'http://localhost:5173',
    DATABASE_URL: 'mysql://u:p@localhost:3306/bd',
    JWT_SECRETO: 'x'.repeat(32),
    JWT_EXPIRACION_SEGUNDOS: '3600',
  };

  it('el tiempo real vacío cuenta como no configurado', () => {
    expect(() =>
      validarVariablesEntorno({
        ...base,
        TIEMPO_REAL_URL: '',
        TIEMPO_REAL_CLAVE_INTERNA: '',
      }),
    ).not.toThrow();
  });

  it('rechaza una clave interna corta', () => {
    expect(() =>
      validarVariablesEntorno({ ...base, TIEMPO_REAL_CLAVE_INTERNA: 'corta' }),
    ).toThrow(/TIEMPO_REAL_CLAVE_INTERNA/);
  });
});
