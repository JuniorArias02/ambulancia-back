import { Injectable } from '@nestjs/common';
import { ConflictoNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import { PrismaService } from '../../../../database/prisma.service.js';
import { Prisma } from '../../../../generated/prisma/client.js';
import {
  DESENLACES,
  ESTADOS_HISTORIA,
  REGIONES_CORPORALES,
  ROLES_VICTIMA,
  SEXOS,
  TIPOS_DOCUMENTO,
  TIPOS_EVENTO,
  TIPOS_INTERVENCION,
  TIPOS_LESION,
  TRIAGES,
  type EstadoHistoria,
} from '../../domain/catalogos_clinicos.js';
import {
  type DatosHistoria,
  HistoriaClinica,
} from '../../domain/entities/historia_clinica.entity.js';
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

const nombre = { select: { nombres: true, apellidos: true } } as const;

const seleccionHistoria = {
  id: true,
  numeroHistoria: true,
  emergenciaId: true,
  asignacionId: true,
  pacienteIdentificado: true,
  nombres: true,
  apellidos: true,
  tipoDocumento: true,
  numeroDocumento: true,
  sexo: true,
  edadAproximada: true,
  fechaNacimiento: true,
  aseguradoraEps: true,
  acompananteNombre: true,
  acompananteTelefono: true,
  horaEvento: true,
  tipoEvento: true,
  mecanismoLesion: true,
  rolVictima: true,
  elementosProteccion: true,
  placaVehiculo: true,
  polizaSoat: true,
  xHemorragiaMasiva: true,
  aViaAerea: true,
  bRespiracion: true,
  cCirculacion: true,
  dNeurologico: true,
  eExposicion: true,
  triage: true,
  alergias: true,
  medicamentosHabituales: true,
  antecedentes: true,
  impresionDiagnostica: true,
  observaciones: true,
  desenlace: true,
  motivoRechazo: true,
  institucionDestinoId: true,
  condicionEntrega: true,
  receptorNombre: true,
  receptorCargo: true,
  entregadoEn: true,
  estado: true,
  creadaPorId: true,
  cerradaPorId: true,
  hashCierre: true,
  abiertaEn: true,
  cerradaEn: true,
  sincronizadaEn: true,
  emergencia: { select: { numeroEmergencia: true } },
  creadaPor: nombre,
  cerradaPor: nombre,
  institucionDestino: { select: { nombre: true } },
} satisfies Prisma.HistoriaClinicaSelect;

type RegistroHistoria = Prisma.HistoriaClinicaGetPayload<{
  select: typeof seleccionHistoria;
}>;

const seleccionSigno = {
  id: true,
  historiaClinicaId: true,
  medidoEn: true,
  presionSistolica: true,
  presionDiastolica: true,
  frecuenciaCardiaca: true,
  frecuenciaRespiratoria: true,
  saturacionOxigeno: true,
  temperatura: true,
  glucometria: true,
  glasgowOcular: true,
  glasgowVerbal: true,
  glasgowMotor: true,
  glasgowTotal: true,
  escalaDolor: true,
  registradoPorId: true,
  registradoPor: nombre,
} satisfies Prisma.SignoVitalSelect;

const seleccionLesion = {
  id: true,
  historiaClinicaId: true,
  regionCorporal: true,
  tipoLesion: true,
  descripcion: true,
} satisfies Prisma.LesionSelect;

const seleccionIntervencion = {
  id: true,
  historiaClinicaId: true,
  tipo: true,
  nombre: true,
  dosis: true,
  via: true,
  realizadoEn: true,
  resultado: true,
  registradoPorId: true,
  registradoPor: nombre,
} satisfies Prisma.IntervencionSelect;

type RegistroSigno = Prisma.SignoVitalGetPayload<{
  select: typeof seleccionSigno;
}>;
type RegistroLesion = Prisma.LesionGetPayload<{
  select: typeof seleccionLesion;
}>;
type RegistroIntervencion = Prisma.IntervencionGetPayload<{
  select: typeof seleccionIntervencion;
}>;

@Injectable()
export class PrismaHistoriasClinicasRepositorio extends HistoriasClinicasRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async buscarPorId(id: string): Promise<HistoriaClinica | null> {
    const registro = await this.prisma.historiaClinica.findUnique({
      where: { id },
      select: seleccionHistoria,
    });
    return registro ? this.aHistoria(registro) : null;
  }

  async buscarDetalle(id: string): Promise<DetalleHistoria | null> {
    const registro = await this.prisma.historiaClinica.findUnique({
      where: { id },
      select: {
        ...seleccionHistoria,
        signosVitales: { select: seleccionSigno, orderBy: { medidoEn: 'asc' } },
        lesiones: { select: seleccionLesion },
        intervenciones: {
          select: seleccionIntervencion,
          orderBy: { realizadoEn: 'asc' },
        },
      },
    });
    if (!registro) return null;
    return {
      historia: this.aHistoria(registro),
      signosVitales: registro.signosVitales.map((s) => this.aSigno(s)),
      lesiones: registro.lesiones.map((l) => this.aLesion(l)),
      intervenciones: registro.intervenciones.map((i) => this.aIntervencion(i)),
    };
  }

  async listar(filtros: FiltrosHistorias): Promise<HistoriaClinica[]> {
    const registros = await this.prisma.historiaClinica.findMany({
      where: {
        asignacionId: filtros.asignacionId,
        emergenciaId: filtros.emergenciaId,
      },
      select: seleccionHistoria,
      orderBy: { abiertaEn: 'asc' },
    });
    return registros.map((r) => this.aHistoria(r));
  }

  async ultimoConsecutivo(prefijo: string): Promise<number> {
    const ultima = await this.prisma.historiaClinica.findFirst({
      where: { numeroHistoria: { startsWith: prefijo } },
      orderBy: { numeroHistoria: 'desc' },
      select: { numeroHistoria: true },
    });
    return ultima ? Number(ultima.numeroHistoria.slice(prefijo.length)) : 0;
  }

  async crear(historia: HistoriaClinica): Promise<HistoriaClinica> {
    try {
      const registro = await this.prisma.historiaClinica.create({
        data: {
          id: historia.id,
          numeroHistoria: historia.numeroHistoria,
          emergenciaId: historia.emergenciaId,
          asignacionId: historia.asignacionId,
          ...historia.datos,
          estado: historia.estado,
          creadaPorId: historia.creadaPorId,
          abiertaEn: historia.abiertaEn,
          sincronizadaEn: historia.sincronizadaEn,
        },
        select: seleccionHistoria,
      });
      return this.aHistoria(registro);
    } catch (error) {
      // El id viene del celular y el número es consecutivo: solo el número puede chocar
      // (el caso de uso ya revisó el id antes de crear).
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new NumeroHistoriaEnUsoError();
      }
      throw error;
    }
  }

  async actualizar(
    historia: HistoriaClinica,
    estadoEsperado: EstadoHistoria,
  ): Promise<HistoriaClinica> {
    const { count } = await this.prisma.historiaClinica.updateMany({
      where: { id: historia.id, estado: estadoEsperado },
      data: {
        ...historia.datos,
        estado: historia.estado,
        cerradaPorId: historia.cerradaPorId,
        cerradaEn: historia.cerradaEn,
        hashCierre: historia.hashCierre,
      },
    });
    if (count === 0) {
      throw new ConflictoNegocioError(
        'La historia clínica cambió mientras tanto; vuelva a consultarla',
      );
    }
    const registro = await this.prisma.historiaClinica.findUniqueOrThrow({
      where: { id: historia.id },
      select: seleccionHistoria,
    });
    return this.aHistoria(registro);
  }

  contarSignosVitales(historiaId: string): Promise<number> {
    return this.prisma.signoVital.count({
      where: { historiaClinicaId: historiaId },
    });
  }

  async agregarSignoVital(signo: SignoVital): Promise<SignoVital> {
    const existente = await this.prisma.signoVital.findUnique({
      where: { id: signo.id },
      select: seleccionSigno,
    });
    if (existente)
      return this.aSigno(
        this.mismaHistoria(existente, signo.historiaClinicaId),
      );
    const { registradoPorNombre: _, ...datos } = signo;
    const creado = await this.prisma.signoVital.create({
      // Registro manual: confirmado desde el inicio (los de voz se confirmarán aparte).
      data: { ...datos, origen: 'manual', confirmado: true },
      select: seleccionSigno,
    });
    return this.aSigno(creado);
  }

  async agregarLesion(lesion: Lesion): Promise<Lesion> {
    const existente = await this.prisma.lesion.findUnique({
      where: { id: lesion.id },
      select: seleccionLesion,
    });
    if (existente)
      return this.aLesion(
        this.mismaHistoria(existente, lesion.historiaClinicaId),
      );
    const creada = await this.prisma.lesion.create({
      data: { ...lesion, origen: 'manual', confirmado: true },
      select: seleccionLesion,
    });
    return this.aLesion(creada);
  }

  async agregarIntervencion(intervencion: Intervencion): Promise<Intervencion> {
    const existente = await this.prisma.intervencion.findUnique({
      where: { id: intervencion.id },
      select: seleccionIntervencion,
    });
    if (existente)
      return this.aIntervencion(
        this.mismaHistoria(existente, intervencion.historiaClinicaId),
      );
    const { registradoPorNombre: _, ...datos } = intervencion;
    const creada = await this.prisma.intervencion.create({
      data: { ...datos, origen: 'manual', confirmado: true },
      select: seleccionIntervencion,
    });
    return this.aIntervencion(creada);
  }

  async eliminarRegistro(
    tipo: TipoRegistroClinico,
    historiaId: string,
    registroId: string,
  ): Promise<boolean> {
    const where = { id: registroId, historiaClinicaId: historiaId };
    const { count } =
      tipo === 'signo_vital'
        ? await this.prisma.signoVital.deleteMany({ where })
        : tipo === 'lesion'
          ? await this.prisma.lesion.deleteMany({ where })
          : await this.prisma.intervencion.deleteMany({ where });
    return count > 0;
  }

  /** Un id reenviado debe pertenecer a la misma historia; si no, es un choque real. */
  private mismaHistoria<T extends { historiaClinicaId: string }>(
    registro: T,
    historiaId: string,
  ): T {
    if (registro.historiaClinicaId !== historiaId) {
      throw new ConflictoNegocioError(
        'Ya existe un registro con ese id en otra historia',
      );
    }
    return registro;
  }

  private aHistoria(r: RegistroHistoria): HistoriaClinica {
    const datos: DatosHistoria = {
      pacienteIdentificado: r.pacienteIdentificado,
      nombres: r.nombres,
      apellidos: r.apellidos,
      tipoDocumento: uno(TIPOS_DOCUMENTO, r.tipoDocumento),
      numeroDocumento: r.numeroDocumento,
      sexo: uno(SEXOS, r.sexo),
      edadAproximada: r.edadAproximada,
      fechaNacimiento: r.fechaNacimiento,
      aseguradoraEps: r.aseguradoraEps,
      acompananteNombre: r.acompananteNombre,
      acompananteTelefono: r.acompananteTelefono,
      horaEvento: r.horaEvento,
      tipoEvento: uno(TIPOS_EVENTO, r.tipoEvento),
      mecanismoLesion: r.mecanismoLesion,
      rolVictima: uno(ROLES_VICTIMA, r.rolVictima),
      elementosProteccion: r.elementosProteccion,
      placaVehiculo: r.placaVehiculo,
      polizaSoat: r.polizaSoat,
      xHemorragiaMasiva: r.xHemorragiaMasiva,
      aViaAerea: r.aViaAerea,
      bRespiracion: r.bRespiracion,
      cCirculacion: r.cCirculacion,
      dNeurologico: r.dNeurologico,
      eExposicion: r.eExposicion,
      triage: uno(TRIAGES, r.triage),
      alergias: r.alergias,
      medicamentosHabituales: r.medicamentosHabituales,
      antecedentes: r.antecedentes,
      impresionDiagnostica: r.impresionDiagnostica,
      observaciones: r.observaciones,
      desenlace: uno(DESENLACES, r.desenlace),
      motivoRechazo: r.motivoRechazo,
      institucionDestinoId: r.institucionDestinoId,
      condicionEntrega: r.condicionEntrega,
      receptorNombre: r.receptorNombre,
      receptorCargo: r.receptorCargo,
      entregadoEn: r.entregadoEn,
    };
    const estado = uno(ESTADOS_HISTORIA, r.estado);
    if (!estado)
      throw new Error(`Estado de historia clínica desconocido: ${r.estado}`);
    return HistoriaClinica.reconstruir({
      id: r.id,
      numeroHistoria: r.numeroHistoria,
      emergenciaId: r.emergenciaId,
      asignacionId: r.asignacionId,
      datos,
      estado,
      creadaPorId: r.creadaPorId,
      cerradaPorId: r.cerradaPorId,
      hashCierre: r.hashCierre,
      abiertaEn: r.abiertaEn,
      cerradaEn: r.cerradaEn,
      sincronizadaEn: r.sincronizadaEn,
      numeroEmergencia: r.emergencia.numeroEmergencia,
      creadaPorNombre: nombreCompleto(r.creadaPor),
      cerradaPorNombre: nombreCompleto(r.cerradaPor),
      institucionDestinoNombre: r.institucionDestino?.nombre ?? null,
    });
  }

  private aSigno(r: RegistroSigno): SignoVital {
    const { registradoPor, temperatura, ...resto } = r;
    return {
      ...resto,
      temperatura: temperatura?.toNumber() ?? null,
      registradoPorNombre: nombreCompleto(registradoPor),
    };
  }

  private aLesion(r: RegistroLesion): Lesion {
    return {
      ...r,
      regionCorporal:
        uno(REGIONES_CORPORALES, r.regionCorporal) ?? 'generalizada',
      tipoLesion: uno(TIPOS_LESION, r.tipoLesion) ?? 'otra',
    };
  }

  private aIntervencion(r: RegistroIntervencion): Intervencion {
    const { registradoPor, ...resto } = r;
    return {
      ...resto,
      tipo: uno(TIPOS_INTERVENCION, r.tipo) ?? 'procedimiento',
      registradoPorNombre: nombreCompleto(registradoPor),
    };
  }
}

/** Valores cargados con otro catálogo se muestran como null en vez de romper la lectura. */
function uno<T extends string>(
  validos: readonly T[],
  valor: string | null,
): T | null {
  return validos.find((v) => v === valor) ?? null;
}

function nombreCompleto(
  usuario: { nombres: string; apellidos: string } | null,
): string | null {
  return usuario ? `${usuario.nombres} ${usuario.apellidos}` : null;
}
