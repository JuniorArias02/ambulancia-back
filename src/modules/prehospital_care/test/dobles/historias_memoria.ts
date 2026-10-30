import { ConflictoNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import type { EstadoHistoria } from '../../domain/catalogos_clinicos.js';
import { HistoriaClinica } from '../../domain/entities/historia_clinica.entity.js';
import type { InstitucionSalud } from '../../domain/entities/institucion_salud.entity.js';
import type {
  Intervencion,
  Lesion,
  SignoVital,
} from '../../domain/entities/registros_clinicos.js';
import {
  type DetalleHistoria,
  type FiltrosHistorias,
  HistoriasClinicasRepositorio,
  NumeroHistoriaEnUsoError,
  type TipoRegistroClinico,
} from '../../domain/repositories/historias_clinicas.repository.js';
import { InstitucionesSaludRepositorio } from '../../domain/repositories/instituciones_salud.repository.js';

export class HistoriasClinicasMemoria extends HistoriasClinicasRepositorio {
  readonly historias = new Map<string, HistoriaClinica>();
  readonly signos: SignoVital[] = [];
  readonly lesiones: Lesion[] = [];
  readonly intervenciones: Intervencion[] = [];

  buscarPorId(id: string): Promise<HistoriaClinica | null> {
    const historia = this.historias.get(id);
    return Promise.resolve(
      historia
        ? HistoriaClinica.reconstruir(this.propiedadesDe(historia))
        : null,
    );
  }

  async buscarDetalle(id: string): Promise<DetalleHistoria | null> {
    const historia = await this.buscarPorId(id);
    if (!historia) return null;
    const deEsta = <T extends { historiaClinicaId: string }>(lista: T[]) =>
      lista.filter((r) => r.historiaClinicaId === id);
    return {
      historia,
      signosVitales: deEsta(this.signos),
      lesiones: deEsta(this.lesiones),
      intervenciones: deEsta(this.intervenciones),
    };
  }

  listar(filtros: FiltrosHistorias): Promise<HistoriaClinica[]> {
    return Promise.resolve(
      [...this.historias.values()].filter(
        (h) =>
          (!filtros.asignacionId || h.asignacionId === filtros.asignacionId) &&
          (!filtros.emergenciaId || h.emergenciaId === filtros.emergenciaId),
      ),
    );
  }

  ultimoConsecutivo(prefijo: string): Promise<number> {
    const usados = [...this.historias.values()]
      .map((h) => h.numeroHistoria)
      .filter((n) => n.startsWith(prefijo))
      .map((n) => Number(n.slice(prefijo.length)));
    return Promise.resolve(Math.max(0, ...usados));
  }

  crear(historia: HistoriaClinica): Promise<HistoriaClinica> {
    const repetido = [...this.historias.values()].some(
      (h) => h.numeroHistoria === historia.numeroHistoria,
    );
    if (repetido) return Promise.reject(new NumeroHistoriaEnUsoError());
    this.historias.set(historia.id, historia);
    return Promise.resolve(historia);
  }

  actualizar(
    historia: HistoriaClinica,
    estadoEsperado: EstadoHistoria,
  ): Promise<HistoriaClinica> {
    if (this.historias.get(historia.id)?.estado !== estadoEsperado) {
      return Promise.reject(new ConflictoNegocioError('Cambió mientras tanto'));
    }
    this.historias.set(historia.id, historia);
    return Promise.resolve(historia);
  }

  contarSignosVitales(historiaId: string): Promise<number> {
    return Promise.resolve(
      this.signos.filter((s) => s.historiaClinicaId === historiaId).length,
    );
  }

  agregarSignoVital(signo: SignoVital): Promise<SignoVital> {
    return Promise.resolve(this.agregar(this.signos, signo));
  }

  agregarLesion(lesion: Lesion): Promise<Lesion> {
    return Promise.resolve(this.agregar(this.lesiones, lesion));
  }

  agregarIntervencion(intervencion: Intervencion): Promise<Intervencion> {
    return Promise.resolve(this.agregar(this.intervenciones, intervencion));
  }

  eliminarRegistro(
    tipo: TipoRegistroClinico,
    historiaId: string,
    registroId: string,
  ): Promise<boolean> {
    const lista: { id: string; historiaClinicaId: string }[] =
      tipo === 'signo_vital'
        ? this.signos
        : tipo === 'lesion'
          ? this.lesiones
          : this.intervenciones;
    const i = lista.findIndex(
      (r) => r.id === registroId && r.historiaClinicaId === historiaId,
    );
    if (i < 0) return Promise.resolve(false);
    lista.splice(i, 1);
    return Promise.resolve(true);
  }

  /** Igual que la base: un id reenviado devuelve el existente. */
  private agregar<T extends { id: string }>(lista: T[], registro: T): T {
    const existente = lista.find((r) => r.id === registro.id);
    if (existente) return existente;
    lista.push(registro);
    return registro;
  }

  /** Copia: así una prueba no ve cambios que el caso de uso no guardó. */
  private propiedadesDe(h: HistoriaClinica) {
    return {
      id: h.id,
      numeroHistoria: h.numeroHistoria,
      emergenciaId: h.emergenciaId,
      asignacionId: h.asignacionId,
      datos: { ...h.datos },
      estado: h.estado,
      creadaPorId: h.creadaPorId,
      cerradaPorId: h.cerradaPorId,
      hashCierre: h.hashCierre,
      abiertaEn: h.abiertaEn,
      cerradaEn: h.cerradaEn,
      sincronizadaEn: h.sincronizadaEn,
      numeroEmergencia: h.numeroEmergencia,
      creadaPorNombre: h.creadaPorNombre,
      cerradaPorNombre: h.cerradaPorNombre,
      institucionDestinoNombre: h.institucionDestinoNombre,
    };
  }
}

/** Solo lo que usa la historia clínica: buscar la institución de destino. */
export class InstitucionesSaludMemoria extends InstitucionesSaludRepositorio {
  readonly instituciones = new Map<string, InstitucionSalud>();

  buscarPorId(id: string): Promise<InstitucionSalud | null> {
    return Promise.resolve(this.instituciones.get(id) ?? null);
  }
  existeCodigoHabilitacion(): Promise<boolean> {
    return Promise.resolve(false);
  }
  listar(): Promise<ResultadoPaginado<InstitucionSalud>> {
    const datos = [...this.instituciones.values()];
    return Promise.resolve({
      datos,
      total: datos.length,
      pagina: 1,
      limite: datos.length,
    });
  }
  listarTodas(): Promise<InstitucionSalud[]> {
    return Promise.resolve([...this.instituciones.values()]);
  }
  crear(institucion: InstitucionSalud): Promise<InstitucionSalud> {
    this.instituciones.set(institucion.id, institucion);
    return Promise.resolve(institucion);
  }
  actualizar(institucion: InstitucionSalud): Promise<InstitucionSalud> {
    return this.crear(institucion);
  }
}
