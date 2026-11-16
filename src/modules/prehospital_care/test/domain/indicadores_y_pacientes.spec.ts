import {
  calcularIndicadores,
  contar,
  diasDelRango,
  estadistica,
  historiasACsv,
} from '../../domain/indicadores_clinicos.js';
import { DATOS_HISTORIA_VACIOS } from '../../domain/entities/historia_clinica.entity.js';
import { documentoEnlazable, reunir } from '../../domain/pacientes.js';
import type { ResumenHistoriaConsulta } from '../../domain/consulta_clinica.js';

describe('Indicadores clínicos', () => {
  it('cuenta con "sin_dato" para los vacíos, de mayor a menor', () => {
    expect(contar(['rojo', null, 'rojo', 'verde'])).toEqual([
      { clave: 'rojo', total: 2 },
      { clave: 'sin_dato', total: 1 },
      { clave: 'verde', total: 1 },
    ]);
  });

  it('promedio, mediana y percentil 90', () => {
    const valores = Array.from({ length: 10 }, (_, i) => (i + 1) * 60);
    expect(estadistica(valores)).toEqual({
      servicios: 10,
      promedioSegundos: 330,
      medianaSegundos: 300,
      p90Segundos: 540,
    });
    expect(estadistica([]).promedioSegundos).toBeNull();
  });

  it('los días del rango incluyen los dos extremos y los días en 0', () => {
    expect(diasDelRango('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
    const indicadores = calcularIndicadores(
      { desde: '2026-11-14', hasta: '2026-11-15' },
      [
        {
          // 15 de nov. 02:00 UTC = 14 de nov. 21:00 en Colombia
          abiertaEn: new Date('2026-11-15T02:00:00Z'),
          estado: 'cerrada',
          triage: 'rojo',
          desenlace: 'rechazo_traslado',
          tipoEvento: null,
          modalidad: 'emergencia',
          firmada: true,
          riesgoCaidaAlto: false,
          pacienteIdentificado: false,
          institucion: null,
        },
      ],
      [
        {
          asignadaEn: new Date('2026-11-15T02:00:00Z'),
          llegadaEscenaEn: new Date('2026-11-15T02:10:00Z'),
          salidaEscenaEn: null,
          llegadaDestinoEn: null,
        },
      ],
    );
    expect(indicadores.porDia).toEqual([
      { dia: '2026-11-14', total: 1 },
      { dia: '2026-11-15', total: 0 },
    ]);
    expect(indicadores).toMatchObject({
      totalHistorias: 1,
      firmadas: 1,
      rechazosTraslado: 1,
      pacientesSinIdentificar: 1,
    });
    expect(indicadores.tiempos.respuesta.medianaSegundos).toBe(600);
    expect(indicadores.tiempos.traslado.servicios).toBe(0);
  });
});

describe('Exportación CSV', () => {
  it('separador ;, BOM, etiquetas, comillas escapadas y sin fórmulas de Excel', () => {
    const csv = historiasACsv([
      {
        id: 'h1',
        numeroHistoria: 'HC-1',
        estado: 'cerrada',
        abiertaEn: new Date('2026-11-15T15:00:00Z'),
        horaEvento: null,
        cerradaEn: null,
        paciente: {
          identificado: true,
          nombres: '=HYPERLINK("x")',
          apellidos: 'Pérez; "El Mono"',
          tipoDocumento: 'CC',
          numeroDocumento: '1090123456',
          sexo: 'masculino',
          fechaNacimiento: null,
          edadAproximada: null,
          edadAnios: 40,
        },
        triage: 'rojo',
        desenlace: 'trasladado',
        tipoEvento: null,
        impresionDiagnostica: null,
        aseguradoraEps: null,
        regimenAfiliacion: null,
        ingreso: {
          emergenciaId: 'e1',
          numeroEmergencia: 'EMG-1',
          modalidad: 'traslado_programado',
        },
        ambulancia: null,
        institucionDestino: null,
        creadaPor: { id: 'p1', nombreCompleto: 'Lucía Rojas' },
        cerradaPor: null,
        firmada: true,
        riesgoCaidaAlto: false,
        totales: {
          signosVitales: 0,
          lesiones: 0,
          intervenciones: 0,
          valoracionesDownton: 0,
        },
      } satisfies ResumenHistoriaConsulta,
    ]);
    const [encabezado, fila] = csv.replace('﻿', '').trim().split('\r\n');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(encabezado?.split(';')).toHaveLength(24);
    expect(fila).toContain('Traslado programado');
    expect(fila).toContain('Rojo (crítico)');
    expect(fila).toContain(`"'=HYPERLINK(""x"")"`);
    expect(fila).toContain('"Pérez; ""El Mono"""');
    expect(fila).toContain('Sí');
  });
});

describe('Índice de pacientes', () => {
  it('solo se enlaza con un documento que identifica a la persona (no AS ni MS)', () => {
    expect(
      documentoEnlazable({
        ...DATOS_HISTORIA_VACIOS,
        tipoDocumento: 'CC',
        numeroDocumento: '123',
      }),
    ).toEqual({ tipoDocumento: 'CC', numeroDocumento: '123' });
    expect(
      documentoEnlazable({
        ...DATOS_HISTORIA_VACIOS,
        tipoDocumento: 'AS',
        numeroDocumento: '123',
      }),
    ).toBeNull();
    expect(
      documentoEnlazable({ ...DATOS_HISTORIA_VACIOS, tipoDocumento: 'CC' }),
    ).toBeNull();
  });

  it('reúne un dato de varias historias sin repetirlo, de la más reciente a la más antigua', () => {
    const fecha = (dia: number) => new Date(Date.UTC(2026, 10, dia));
    expect(
      reunir([
        {
          id: 'a',
          numeroHistoria: 'HC-A',
          abiertaEn: fecha(1),
          valor: 'Penicilina',
        },
        {
          id: 'b',
          numeroHistoria: 'HC-B',
          abiertaEn: fecha(5),
          valor: 'penicilina ',
        },
        {
          id: 'c',
          numeroHistoria: 'HC-C',
          abiertaEn: fecha(3),
          valor: 'Ibuprofeno',
        },
        { id: 'd', numeroHistoria: 'HC-D', abiertaEn: fecha(4), valor: null },
      ]).map((d) => [d.valor, d.numeroHistoria]),
    ).toEqual([
      ['penicilina', 'HC-B'],
      ['Ibuprofeno', 'HC-C'],
    ]);
  });
});
