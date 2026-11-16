import { AuditoriaMemoria } from '../../../../../../test/dobles/repositorios_memoria.js';
import { AsignacionesMemoria } from '../../../../../../test/dobles/asignaciones_memoria.js';
import { AmbulanciasMemoria } from '../../../../../../test/dobles/ambulancias_memoria.js';
import { EmergenciasMemoria } from '../../../../../../test/dobles/emergencias_memoria.js';
import { TurnosMemoria } from '../../../../../../test/dobles/turnos_memoria.js';
import { Roles } from '../../../../../common/constants/roles.js';
import {
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../../common/exceptions/errores_dominio.js';
import type { ResultadoPaginado } from '../../../../../common/types/resultado_paginado.js';
import { AccesoHistoriaClinica } from '../../../application/services/acceso_historia_clinica.service.js';
import { BuscarHistoriasClinicas } from '../../../application/use-cases/buscar_historias_clinicas.use-case.js';
import { ConsultarTrazabilidadHistoria } from '../../../application/use-cases/consultar_trazabilidad_historia.use-case.js';
import { ObtenerIngreso } from '../../../application/use-cases/obtener_ingreso.use-case.js';
import type {
  EventoTrazabilidad,
  FiltrosBusquedaHistorias,
  IngresoServicio,
  ResumenHistoriaConsulta,
} from '../../../domain/consulta_clinica.js';
import { HistoriaClinica } from '../../../domain/entities/historia_clinica.entity.js';
import { ConsultaClinicaRepositorio } from '../../../domain/repositories/consulta_clinica.repository.js';
import type {
  FichaPaciente,
  FiltrosPacientes,
  PacienteResumen,
} from '../../../domain/pacientes.js';
import type {
  FilaIndicadorHistoria,
  FilaIndicadorServicio,
} from '../../../domain/indicadores_clinicos.js';
import { BuscarPacientes } from '../../../application/use-cases/buscar_pacientes.use-case.js';
import { ObtenerFichaPaciente } from '../../../application/use-cases/obtener_ficha_paciente.use-case.js';
import { ExportarHistoriasCsv } from '../../../application/use-cases/exportar_historias_csv.use-case.js';
import { ConsultarIndicadoresClinicos } from '../../../application/use-cases/consultar_indicadores_clinicos.use-case.js';
import { HistoriasClinicasMemoria } from '../../dobles/historias_memoria.js';

/** Guarda los filtros recibidos y devuelve lo que la prueba prepare. */
class ConsultaClinicaMemoria extends ConsultaClinicaRepositorio {
  ultimosFiltros: FiltrosBusquedaHistorias | null = null;
  ingresos = new Map<string, IngresoServicio>();
  eventos: EventoTrazabilidad[] = [];

  buscarHistorias(
    filtros: FiltrosBusquedaHistorias,
  ): Promise<ResultadoPaginado<ResumenHistoriaConsulta>> {
    this.ultimosFiltros = filtros;
    if (this.historiasExportables > 0) {
      return Promise.resolve({
        datos: Array.from(
          { length: Math.min(this.historiasExportables, filtros.limite) },
          () => RESUMEN,
        ),
        total: this.historiasExportables,
        pagina: 1,
        limite: filtros.limite,
      });
    }
    return Promise.resolve({
      datos: [],
      total: 7,
      pagina: filtros.pagina,
      limite: filtros.limite,
    });
  }
  obtenerIngreso(numeroOId: string): Promise<IngresoServicio | null> {
    return Promise.resolve(this.ingresos.get(numeroOId) ?? null);
  }
  pacientes: ResultadoPaginado<PacienteResumen> = {
    datos: [],
    total: 3,
    pagina: 1,
    limite: 20,
  };
  ultimosFiltrosPacientes: FiltrosPacientes | null = null;
  historiasExportables = 0;

  buscarPacientes(
    f: FiltrosPacientes,
  ): Promise<ResultadoPaginado<PacienteResumen>> {
    this.ultimosFiltrosPacientes = f;
    return Promise.resolve(this.pacientes);
  }
  fichaPaciente(): Promise<FichaPaciente | null> {
    return Promise.resolve(null);
  }
  datosIndicadores(): Promise<{
    historias: FilaIndicadorHistoria[];
    servicios: FilaIndicadorServicio[];
  }> {
    return Promise.resolve({ historias: [], servicios: [] });
  }
  trazabilidad(
    _historiaId: string,
    pagina: number,
    limite: number,
  ): Promise<ResultadoPaginado<EventoTrazabilidad>> {
    return Promise.resolve({
      datos: this.eventos,
      total: this.eventos.length,
      pagina,
      limite,
    });
  }
}

const admin = {
  usuarioId: 'admin-1',
  direccionIp: '10.0.0.1',
  rol: Roles.ADMINISTRADOR,
};

describe('Consulta clínica (casos de uso)', () => {
  let consulta: ConsultaClinicaMemoria;
  let auditoria: AuditoriaMemoria;
  let historias: HistoriasClinicasMemoria;
  let buscar: BuscarHistoriasClinicas;
  let obtenerIngreso: ObtenerIngreso;
  let trazabilidad: ConsultarTrazabilidadHistoria;

  beforeEach(() => {
    consulta = new ConsultaClinicaMemoria();
    auditoria = new AuditoriaMemoria();
    historias = new HistoriasClinicasMemoria();
    const ambulancias = new AmbulanciasMemoria();
    const acceso = new AccesoHistoriaClinica(
      historias,
      new AsignacionesMemoria(ambulancias, new EmergenciasMemoria()),
      new TurnosMemoria(),
    );
    buscar = new BuscarHistoriasClinicas(consulta, auditoria);
    obtenerIngreso = new ObtenerIngreso(consulta, auditoria);
    trazabilidad = new ConsultarTrazabilidadHistoria(
      consulta,
      acceso,
      auditoria,
    );
  });

  it('arma los filtros: documento normalizado, ingreso en mayúsculas, vigentes por defecto', async () => {
    await buscar.ejecutar(
      {
        desde: '2026-11-01',
        hasta: '2026-11-14',
        documento: '1.090.123-456',
        ingreso: ' emg-20261114 ',
        nombre: 'juan pérez',
        pagina: 2,
        limite: 50,
      },
      admin,
    );
    expect(consulta.ultimosFiltros).toMatchObject({
      campoFecha: 'atencion',
      documento: '1090123456',
      ingreso: 'EMG-20261114',
      palabrasNombre: ['juan', 'pérez'],
      estados: ['borrador', 'cerrada'],
      orden: 'fecha_desc',
      pagina: 2,
      limite: 50,
    });
  });

  it('la búsqueda queda auditada con los filtros usados, sin el documento ni el nombre', async () => {
    await buscar.ejecutar(
      {
        documento: '1090123456',
        nombre: 'juan',
        triage: 'rojo',
        pagina: 1,
        limite: 20,
      },
      admin,
    );
    const evento = auditoria.eventos.at(-1);
    expect(evento).toMatchObject({
      entidad: 'consulta_clinica',
      accion: 'buscar_historias',
      detalle: { filtros: ['documento', 'nombre', 'triage'], resultados: 7 },
    });
    expect(JSON.stringify(evento)).not.toMatch(/1090123456|juan/);
  });

  it('un rango de fechas inválido se rechaza sin consultar', async () => {
    await expect(
      buscar.ejecutar(
        { desde: '2026-11-15', hasta: '2026-11-01', pagina: 1, limite: 20 },
        admin,
      ),
    ).rejects.toThrow(ReglaNegocioError);
    expect(consulta.ultimosFiltros).toBeNull();
  });

  it('el ingreso inexistente da 404; el existente queda auditado sobre la emergencia', async () => {
    await expect(
      obtenerIngreso.ejecutar('EMG-NO-EXISTE', admin),
    ).rejects.toThrow(RecursoNoEncontradoError);
    consulta.ingresos.set('EMG-20261114-0003', {
      emergencia: {
        id: 'e1',
        numeroEmergencia: 'EMG-20261114-0003',
      } as IngresoServicio['emergencia'],
      asignaciones: [],
      historias: [],
    });

    await obtenerIngreso.ejecutar(' EMG-20261114-0003 ', admin);

    expect(auditoria.eventos.at(-1)).toMatchObject({
      entidad: 'emergencias',
      entidadId: 'e1',
      accion: 'consultar_ingreso',
    });
  });

  it('la trazabilidad exige que la historia exista y registra la consulta después de leer', async () => {
    await expect(
      trazabilidad.ejecutar(
        '00000000-0000-4000-8000-000000000000',
        { pagina: 1, limite: 20 },
        admin,
      ),
    ).rejects.toThrow(RecursoNoEncontradoError);

    const historia = HistoriaClinica.abrir({
      id: 'h1',
      numeroHistoria: 'HC-20261114-0001',
      emergenciaId: 'e1',
      asignacionId: 'a1',
      creadaPorId: 'p1',
      abiertaEn: new Date(),
      sincronizadaEn: new Date(),
    });
    historias.historias.set(historia.id, historia);
    const resultado = await trazabilidad.ejecutar(
      'h1',
      { pagina: 1, limite: 20 },
      admin,
    );

    expect(resultado.total).toBe(0);
    expect(auditoria.eventos.at(-1)).toMatchObject({
      entidadId: 'h1',
      accion: 'consultar_trazabilidad',
    });
  });

  it('pacientes: documento normalizado y auditoría sin el documento ni el nombre', async () => {
    const buscarPacientes = new BuscarPacientes(consulta, auditoria);
    await buscarPacientes.ejecutar(
      { documento: '1.090.123.456', nombre: 'pérez', pagina: 1, limite: 20 },
      admin,
    );
    expect(consulta.ultimosFiltrosPacientes).toMatchObject({
      documento: '1090123456',
      palabrasNombre: ['pérez'],
    });
    const evento = auditoria.eventos.at(-1);
    expect(evento).toMatchObject({
      accion: 'buscar_pacientes',
      detalle: { filtros: ['documento', 'nombre'], resultados: 3 },
    });
    expect(JSON.stringify(evento)).not.toMatch(/1090123456|pérez/);
  });

  it('ficha de un paciente inexistente: 404', async () => {
    await expect(
      new ObtenerFichaPaciente(consulta, auditoria).ejecutar('p-x', admin),
    ).rejects.toThrow(RecursoNoEncontradoError);
  });

  it('exportar: CSV con BOM y separador ;, auditado; más de 5000 filas da 422', async () => {
    const exportar = new ExportarHistoriasCsv(consulta, auditoria);
    consulta.historiasExportables = 2;
    const { contenido, nombreArchivo } = await exportar.ejecutar(
      { triage: 'rojo' },
      admin,
    );
    expect(nombreArchivo).toMatch(
      /^historias-clinicas-\d{4}-\d{2}-\d{2}\.csv$/,
    );
    expect(contenido.startsWith('\uFEFFNúmero de historia;Ingreso;')).toBe(
      true,
    );
    expect(contenido.trim().split('\r\n')).toHaveLength(3);
    expect(auditoria.eventos.at(-1)).toMatchObject({
      accion: 'exportar_historias',
      detalle: { filtros: ['triage'], filas: 2 },
    });

    consulta.historiasExportables = 5001;
    await expect(exportar.ejecutar({}, admin)).rejects.toThrow(/más de 5000/);
  });

  it('indicadores: por defecto los últimos 30 días, auditado', async () => {
    const indicadores = await new ConsultarIndicadoresClinicos(
      consulta,
      auditoria,
    ).ejecutar({ hasta: '2026-11-15' }, admin);
    expect(indicadores.rango).toEqual({
      desde: '2026-10-17',
      hasta: '2026-11-15',
    });
    expect(indicadores.porDia).toHaveLength(30);
    expect(auditoria.eventos.at(-1)?.accion).toBe('consultar_indicadores');
  });
});

const RESUMEN: ResumenHistoriaConsulta = {
  id: 'h1',
  numeroHistoria: 'HC-20261115-0001',
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
    edadAproximada: 40,
    edadAnios: 40,
  },
  triage: 'rojo',
  desenlace: 'trasladado',
  tipoEvento: 'transito',
  impresionDiagnostica: null,
  aseguradoraEps: 'Nueva EPS',
  regimenAfiliacion: 'subsidiado',
  ingreso: {
    emergenciaId: 'e1',
    numeroEmergencia: 'EMG-20261115-0001',
    modalidad: 'emergencia',
  },
  ambulancia: null,
  institucionDestino: null,
  creadaPor: { id: 'p1', nombreCompleto: 'Lucía Rojas' },
  cerradaPor: null,
  firmada: true,
  riesgoCaidaAlto: false,
  totales: {
    signosVitales: 1,
    lesiones: 0,
    intervenciones: 0,
    valoracionesDownton: 0,
  },
};
