import { Injectable } from '@nestjs/common';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type { ModalidadServicio } from '../../../emergencies/domain/entities/emergencia.entity.js';
import type {
  Desenlace,
  RegimenAfiliacion,
  TipoEvento,
  Triage,
} from '../../domain/catalogos_clinicos.js';
import {
  type CampoFechaConsulta,
  type EstadoFiltroConsulta,
  estadosDelFiltro,
  type FiltrosBusquedaHistorias,
  filtrosUsados,
  normalizarDocumento,
  type OrdenConsulta,
  palabrasDeNombre,
  rangoDesdeDias,
  type ResumenHistoriaConsulta,
} from '../../domain/consulta_clinica.js';
import { ConsultaClinicaRepositorio } from '../../domain/repositories/consulta_clinica.repository.js';

export interface BuscarHistoriasEntrada {
  /** Días de Colombia, `AAAA-MM-DD`; `hasta` incluido. */
  desde?: string;
  hasta?: string;
  campoFecha?: CampoFechaConsulta;
  ingreso?: string;
  numeroHistoria?: string;
  documento?: string;
  nombre?: string;
  soloNn?: boolean;
  estado?: EstadoFiltroConsulta;
  triage?: Triage;
  desenlace?: Desenlace;
  tipoEvento?: TipoEvento;
  riesgoCaidaAlto?: boolean;
  firmada?: boolean;
  ambulanciaId?: string;
  institucionDestinoId?: string;
  profesionalId?: string;
  eps?: string;
  regimen?: RegimenAfiliacion;
  modalidad?: ModalidadServicio;
  orden?: OrdenConsulta;
  pagina: number;
  limite: number;
}

/**
 * Bandeja de la consulta clínica web: busca historias por fecha, ingreso,
 * número, paciente y datos clínicos. Devuelve resúmenes; el expediente sale
 * por el detalle de la historia (auditado aparte).
 */
@Injectable()
export class BuscarHistoriasClinicas {
  constructor(
    private readonly consultaRepositorio: ConsultaClinicaRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    entrada: BuscarHistoriasEntrada,
    contexto: ContextoSolicitud,
  ): Promise<ResultadoPaginado<ResumenHistoriaConsulta>> {
    const filtros = armarFiltrosBusqueda(entrada);
    const resultado = await this.consultaRepositorio.buscarHistorias(filtros);

    // Qué filtros se usaron, nunca sus valores: el documento o el nombre
    // buscados no se repiten en la auditoría.
    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'consulta_clinica',
      entidadId: contexto.usuarioId ?? 'desconocido',
      accion: 'buscar_historias',
      detalle: {
        filtros: filtrosUsados(filtros),
        estado: entrada.estado ?? 'vigentes',
        resultados: resultado.total,
      },
      direccionIp: contexto.direccionIp,
    });
    return resultado;
  }
}

/** Entrada (DTO) → filtros del dominio. La usan la bandeja y la exportación. */
export function armarFiltrosBusqueda(
  entrada: BuscarHistoriasEntrada,
): FiltrosBusquedaHistorias {
  const texto = (valor: string | undefined) => valor?.trim() || undefined;
  const palabras = palabrasDeNombre(entrada.nombre);
  return {
    rango: rangoDesdeDias(entrada.desde, entrada.hasta),
    campoFecha: entrada.campoFecha ?? 'atencion',
    ingreso: texto(entrada.ingreso)?.toUpperCase(),
    numeroHistoria: texto(entrada.numeroHistoria)?.toUpperCase(),
    documento: texto(entrada.documento)
      ? normalizarDocumento(entrada.documento ?? '')
      : undefined,
    palabrasNombre: palabras.length > 0 ? palabras : undefined,
    soloNn: entrada.soloNn || undefined,
    estados: estadosDelFiltro(entrada.estado),
    triage: entrada.triage,
    desenlace: entrada.desenlace,
    tipoEvento: entrada.tipoEvento,
    riesgoCaidaAlto: entrada.riesgoCaidaAlto,
    firmada: entrada.firmada,
    ambulanciaId: entrada.ambulanciaId,
    institucionDestinoId: entrada.institucionDestinoId,
    profesionalId: entrada.profesionalId,
    eps: texto(entrada.eps),
    regimen: entrada.regimen,
    modalidad: entrada.modalidad,
    orden: entrada.orden ?? 'fecha_desc',
    pagina: entrada.pagina,
    limite: entrada.limite,
  };
}
