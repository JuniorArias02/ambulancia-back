import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import type {
  FilaIndicadorHistoria,
  FilaIndicadorServicio,
} from '../indicadores_clinicos.js';
import type {
  RangoFechas,
  EventoTrazabilidad,
  FiltrosBusquedaHistorias,
  IngresoServicio,
  ResumenHistoriaConsulta,
} from '../consulta_clinica.js';
import type {
  FichaPaciente,
  FiltrosPacientes,
  PacienteResumen,
} from '../pacientes.js';

/** Lecturas de la consulta clínica web. No escribe nada. */
export abstract class ConsultaClinicaRepositorio {
  abstract buscarHistorias(
    filtros: FiltrosBusquedaHistorias,
  ): Promise<ResultadoPaginado<ResumenHistoriaConsulta>>;
  /** Por el número del ingreso (`EMG-…`) o por el id de la emergencia. */
  abstract obtenerIngreso(numeroOId: string): Promise<IngresoServicio | null>;
  abstract buscarPacientes(
    filtros: FiltrosPacientes,
  ): Promise<ResultadoPaginado<PacienteResumen>>;
  abstract fichaPaciente(pacienteId: string): Promise<FichaPaciente | null>;
  /** Historias abiertas y asignaciones de ingresos recibidos en el rango, para los indicadores. */
  abstract datosIndicadores(rango: RangoFechas): Promise<{
    historias: FilaIndicadorHistoria[];
    servicios: FilaIndicadorServicio[];
  }>;
  /** Eventos de auditoría de la historia, del más antiguo al más reciente. */
  abstract trazabilidad(
    historiaId: string,
    pagina: number,
    limite: number,
  ): Promise<ResultadoPaginado<EventoTrazabilidad>>;
}
