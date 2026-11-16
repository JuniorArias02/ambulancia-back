import { Injectable } from '@nestjs/common';
import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type { OrigenRegistro } from '../../domain/catalogos_clinicos.js';
import {
  crearValoracionDownton,
  type RespuestasDownton,
  type ValoracionDownton,
} from '../../domain/entities/valoracion_downton.entity.js';
import { HistoriasClinicasRepositorio } from '../../domain/repositories/historias_clinicas.repository.js';
import { AccesoHistoriaClinica } from '../services/acceso_historia_clinica.service.js';

export interface RegistrarValoracionDowntonEntrada {
  /** Generado en el celular: reenviarlo no duplica. */
  id?: string;
  evaluadaEn?: Date;
  respuestas: RespuestasDownton;
  observacion?: string;
  origen?: OrigenRegistro;
  segmentoAudioId?: string;
}

/**
 * Agrega una valoración de riesgo de caídas (J.H. Downton) a una historia en
 * borrador. Solo la tripulación clínica del servicio. El puntaje y el nivel
 * de riesgo se calculan aquí, nunca se toman del cliente.
 */
@Injectable()
export class RegistrarValoracionDownton {
  constructor(
    private readonly historiasRepositorio: HistoriasClinicasRepositorio,
    private readonly acceso: AccesoHistoriaClinica,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    historiaId: string,
    datos: RegistrarValoracionDowntonEntrada,
    contexto: ContextoSolicitud,
  ): Promise<ValoracionDownton> {
    await this.acceso.cargarParaEditar(historiaId, contexto);
    const ahora = new Date();
    const nueva = crearValoracionDownton({
      id: datos.id ?? crypto.randomUUID(),
      historiaClinicaId: historiaId,
      evaluadaEn: datos.evaluadaEn ?? ahora,
      respuestas: datos.respuestas,
      observacion: datos.observacion,
      origen: datos.origen ?? 'manual',
      segmentoAudioId: datos.segmentoAudioId,
      registradoPorId: contexto.usuarioId ?? '',
      ahora,
    });
    if (
      nueva.segmentoAudioId &&
      !(await this.historiasRepositorio.segmentoAudioDeHistoria(
        nueva.segmentoAudioId,
        historiaId,
      ))
    ) {
      throw new ReglaNegocioError(
        'El segmento de audio no pertenece a una grabación de esta historia',
      );
    }
    const valoracion =
      await this.historiasRepositorio.agregarValoracionDownton(nueva);

    // Sin puntaje ni respuestas: la auditoría no guarda valores clínicos.
    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'historias_clinicas',
      entidadId: historiaId,
      accion: 'registrar_valoracion_downton',
      detalle: { registroId: valoracion.id },
      direccionIp: contexto.direccionIp,
    });
    return valoracion;
  }
}
