import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import {
  DESENLACES,
  ESTADOS_HISTORIA,
  REGIMENES_AFILIACION,
  SEXOS,
  TIPOS_DOCUMENTO,
  TIPOS_EVENTO,
  TRIAGES,
} from '../../domain/catalogos_clinicos.js';
import {
  type AsignacionIngreso,
  calcularTiemposServicio,
  type CampoFechaConsulta,
  CLAVES_DETALLE_TRAZABILIDAD,
  DESCRIPCIONES_ACCION_HISTORIA,
  edadEnAnios,
  type EventoTrazabilidad,
  type FiltrosBusquedaHistorias,
  type IngresoServicio,
  muestrearRecorrido,
  PATRON_UUID,
  type PersonaConsulta,
  type RangoFechas,
  PUNTOS_MAXIMOS_RECORRIDO,
  type ResumenHistoriaConsulta,
  tipoDeAccion,
} from '../../domain/consulta_clinica.js';
import { ConsultaClinicaRepositorio } from '../../domain/repositories/consulta_clinica.repository.js';
import type {
  FilaIndicadorHistoria,
  FilaIndicadorServicio,
} from '../../domain/indicadores_clinicos.js';
import {
  type FichaPaciente,
  type FiltrosPacientes,
  type PacienteResumen,
  reunir,
} from '../../domain/pacientes.js';
import {
  MODALIDADES_SERVICIO,
  type ModalidadServicio,
} from '../../../emergencies/domain/entities/emergencia.entity.js';

const nombre = {
  select: { id: true, nombres: true, apellidos: true },
} as const;

const seleccionResumen = {
  id: true,
  numeroHistoria: true,
  estado: true,
  abiertaEn: true,
  horaEvento: true,
  cerradaEn: true,
  pacienteIdentificado: true,
  nombres: true,
  apellidos: true,
  tipoDocumento: true,
  numeroDocumento: true,
  sexo: true,
  fechaNacimiento: true,
  edadAproximada: true,
  triage: true,
  desenlace: true,
  tipoEvento: true,
  impresionDiagnostica: true,
  aseguradoraEps: true,
  regimenAfiliacion: true,
  emergenciaId: true,
  emergencia: { select: { numeroEmergencia: true, modalidad: true } },
  asignacion: {
    select: { ambulancia: { select: { id: true, codigo: true, placa: true } } },
  },
  institucionDestino: { select: { id: true, nombre: true } },
  creadaPor: nombre,
  cerradaPor: nombre,
  firmaCierreId: true,
  valoracionesDownton: {
    where: { nivelRiesgo: 'alto' },
    select: { id: true },
    take: 1,
  },
  _count: {
    select: {
      signosVitales: true,
      lesiones: true,
      intervenciones: true,
      valoracionesDownton: true,
    },
  },
} satisfies Prisma.HistoriaClinicaSelect;

type RegistroResumen = Prisma.HistoriaClinicaGetPayload<{
  select: typeof seleccionResumen;
}>;

const seleccionPaciente = {
  id: true,
  tipoDocumento: true,
  numeroDocumento: true,
  nombres: true,
  apellidos: true,
  sexo: true,
  fechaNacimiento: true,
  _count: { select: { historias: true } },
  historias: {
    orderBy: { abiertaEn: 'desc' },
    take: 1,
    select: { abiertaEn: true, aseguradoraEps: true, regimenAfiliacion: true },
  },
} satisfies Prisma.PacienteSelect;

type RegistroPaciente = Prisma.PacienteGetPayload<{
  select: typeof seleccionPaciente;
}>;

function aPaciente(r: RegistroPaciente): PacienteResumen {
  const ultima = r.historias[0] ?? null;
  return {
    id: r.id,
    tipoDocumento: r.tipoDocumento,
    numeroDocumento: r.numeroDocumento,
    nombres: r.nombres,
    apellidos: r.apellidos,
    sexo: uno(SEXOS, r.sexo),
    fechaNacimiento: r.fechaNacimiento,
    edadAnios: r.fechaNacimiento
      ? edadEnAnios(r.fechaNacimiento, new Date())
      : null,
    totalAtenciones: r._count.historias,
    ultimaAtencion: ultima?.abiertaEn ?? null,
    ultimaEps: ultima?.aseguradoraEps ?? null,
    ultimoRegimen: ultima?.regimenAfiliacion ?? null,
  };
}

const seleccionAsignacion = {
  id: true,
  estado: true,
  asignadaEn: true,
  salidaEn: true,
  llegadaEscenaEn: true,
  atencionInicioEn: true,
  salidaEscenaEn: true,
  llegadaDestinoEn: true,
  finalizadaEn: true,
  motivoCancelacion: true,
  ambulancia: {
    select: {
      id: true,
      codigo: true,
      placa: true,
      tipoAmbulancia: { select: { nombre: true } },
    },
  },
  turno: {
    select: {
      integrantes: { select: { funcion: true, usuario: nombre } },
    },
  },
  asignadaPor: nombre,
  institucionDestino: {
    select: { id: true, nombre: true, direccion: true },
  },
  eventos: {
    orderBy: { ocurridoEn: 'asc' },
    select: {
      estadoAnterior: true,
      estadoNuevo: true,
      ocurridoEn: true,
      rolResponsable: true,
      latitud: true,
      longitud: true,
      distanciaEscenaMetros: true,
      fueraDeRadio: true,
      observacion: true,
      usuario: nombre,
    },
  },
  movimientosInventario: {
    orderBy: { realizadoEn: 'asc' },
    select: {
      id: true,
      codigo: true,
      tipo: true,
      estado: true,
      realizadoEn: true,
      usuario: nombre,
      detalles: {
        select: {
          cantidad: true,
          insumo: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
              unidadMedida: true,
            },
          },
          lote: { select: { numeroLote: true } },
          equipo: { select: { numeroSerie: true } },
        },
      },
    },
  },
} satisfies Prisma.AsignacionServicioSelect;

type RegistroAsignacion = Prisma.AsignacionServicioGetPayload<{
  select: typeof seleccionAsignacion;
}>;

const seleccionEmergencia = {
  id: true,
  numeroEmergencia: true,
  fuente: true,
  modalidad: true,
  estado: true,
  descripcion: true,
  tipoIncidente: true,
  prioridad: true,
  direccion: true,
  referenciaLugar: true,
  latitud: true,
  longitud: true,
  origenUbicacion: true,
  numeroVictimas: true,
  informanteNombre: true,
  informanteTelefono: true,
  informanteUsuarioId: true,
  recibidaEn: true,
  cerradaEn: true,
  recibidaPor: nombre,
  emergenciaPrincipal: { select: { id: true, numeroEmergencia: true } },
  duplicadas: {
    orderBy: { recibidaEn: 'asc' },
    select: { id: true, numeroEmergencia: true, recibidaEn: true },
  },
  asignaciones: { orderBy: { asignadaEn: 'asc' }, select: seleccionAsignacion },
} satisfies Prisma.EmergenciaSelect;

@Injectable()
export class PrismaConsultaClinicaRepositorio extends ConsultaClinicaRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async buscarHistorias(
    filtros: FiltrosBusquedaHistorias,
  ): Promise<ResultadoPaginado<ResumenHistoriaConsulta>> {
    const where = construirFiltro(filtros);
    const [total, registros] = await this.prisma.$transaction([
      this.prisma.historiaClinica.count({ where }),
      this.prisma.historiaClinica.findMany({
        where,
        select: seleccionResumen,
        orderBy: ordenar(filtros),
        skip: (filtros.pagina - 1) * filtros.limite,
        take: filtros.limite,
      }),
    ]);
    return {
      datos: registros.map(aResumen),
      total,
      pagina: filtros.pagina,
      limite: filtros.limite,
    };
  }

  async obtenerIngreso(numeroOId: string): Promise<IngresoServicio | null> {
    const emergencia = await this.prisma.emergencia.findFirst({
      where: PATRON_UUID.test(numeroOId)
        ? { id: numeroOId.toLowerCase() }
        : { numeroEmergencia: numeroOId.toUpperCase() },
      select: seleccionEmergencia,
    });
    if (!emergencia) return null;

    const [historias, recorridos] = await Promise.all([
      this.prisma.historiaClinica.findMany({
        where: { emergenciaId: emergencia.id },
        select: seleccionResumen,
        orderBy: { abiertaEn: 'asc' },
      }),
      Promise.all(
        emergencia.asignaciones.map((a) =>
          this.prisma.ubicacionAmbulancia.findMany({
            where: { asignacionId: a.id },
            select: {
              latitud: true,
              longitud: true,
              velocidad: true,
              registradaEn: true,
            },
            orderBy: { registradaEn: 'asc' },
          }),
        ),
      ),
    ]);

    const { asignaciones, recibidaPor, informanteUsuarioId, ...datos } =
      emergencia;
    return {
      emergencia: {
        ...datos,
        modalidad: modalidad(datos.modalidad),
        latitud: numero(datos.latitud),
        longitud: numero(datos.longitud),
        reportadaDesdeApp: informanteUsuarioId !== null,
        recibidaPor: persona(recibidaPor),
      },
      asignaciones: asignaciones.map((a, i) =>
        aAsignacion(a, emergencia.recibidaEn, recorridos[i] ?? []),
      ),
      historias: historias.map(aResumen),
    };
  }

  async buscarPacientes(
    f: FiltrosPacientes,
  ): Promise<ResultadoPaginado<PacienteResumen>> {
    const y: Prisma.PacienteWhereInput[] = [];
    if (f.documento) y.push({ numeroDocumento: f.documento });
    for (const palabra of f.palabrasNombre ?? []) {
      y.push({
        OR: [
          { nombres: { startsWith: palabra } },
          { nombres: { contains: ` ${palabra}` } },
          { apellidos: { startsWith: palabra } },
          { apellidos: { contains: ` ${palabra}` } },
        ],
      });
    }
    const where: Prisma.PacienteWhereInput = { AND: y };
    const [total, registros] = await this.prisma.$transaction([
      this.prisma.paciente.count({ where }),
      this.prisma.paciente.findMany({
        where,
        select: seleccionPaciente,
        orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
        skip: (f.pagina - 1) * f.limite,
        take: f.limite,
      }),
    ]);
    return {
      datos: registros.map(aPaciente),
      total,
      pagina: f.pagina,
      limite: f.limite,
    };
  }

  async fichaPaciente(pacienteId: string): Promise<FichaPaciente | null> {
    const paciente = await this.prisma.paciente.findUnique({
      where: { id: pacienteId },
      select: seleccionPaciente,
    });
    if (!paciente) return null;
    const [historias, riesgo] = await Promise.all([
      this.prisma.historiaClinica.findMany({
        where: { pacienteId },
        select: {
          ...seleccionResumen,
          alergias: true,
          medicamentosHabituales: true,
          antecedentes: true,
        },
        orderBy: { abiertaEn: 'desc' },
      }),
      this.prisma.valoracionDownton.findFirst({
        where: { historiaClinica: { pacienteId } },
        orderBy: { evaluadaEn: 'desc' },
        select: {
          puntajeTotal: true,
          nivelRiesgo: true,
          evaluadaEn: true,
          historiaClinica: { select: { numeroHistoria: true } },
        },
      }),
    ]);
    const de = (
      campo: 'alergias' | 'medicamentosHabituales' | 'antecedentes',
    ) =>
      reunir(
        historias.map((h) => ({
          id: h.id,
          numeroHistoria: h.numeroHistoria,
          abiertaEn: h.abiertaEn,
          valor: h[campo],
        })),
      );
    return {
      paciente: aPaciente(paciente),
      atenciones: historias.map(aResumen),
      alergias: de('alergias'),
      medicamentosHabituales: de('medicamentosHabituales'),
      antecedentes: de('antecedentes'),
      ultimoRiesgoCaida: riesgo
        ? {
            puntajeTotal: riesgo.puntajeTotal,
            nivelRiesgo: riesgo.nivelRiesgo,
            evaluadaEn: riesgo.evaluadaEn,
            numeroHistoria: riesgo.historiaClinica.numeroHistoria,
          }
        : null,
    };
  }

  async datosIndicadores(rango: RangoFechas): Promise<{
    historias: FilaIndicadorHistoria[];
    servicios: FilaIndicadorServicio[];
  }> {
    const fecha: Prisma.DateTimeFilter = {
      ...(rango.desde && { gte: rango.desde }),
      ...(rango.hastaExclusivo && { lt: rango.hastaExclusivo }),
    };
    const [historias, servicios] = await Promise.all([
      this.prisma.historiaClinica.findMany({
        where: { abiertaEn: fecha },
        select: {
          abiertaEn: true,
          estado: true,
          triage: true,
          desenlace: true,
          tipoEvento: true,
          pacienteIdentificado: true,
          firmaCierreId: true,
          emergencia: { select: { modalidad: true } },
          institucionDestino: { select: { id: true, nombre: true } },
          valoracionesDownton: {
            where: { nivelRiesgo: 'alto' },
            select: { id: true },
            take: 1,
          },
        },
      }),
      this.prisma.asignacionServicio.findMany({
        where: {
          estado: { not: 'cancelada' },
          emergencia: { recibidaEn: fecha },
        },
        select: {
          asignadaEn: true,
          llegadaEscenaEn: true,
          salidaEscenaEn: true,
          llegadaDestinoEn: true,
        },
      }),
    ]);
    return {
      historias: historias.map((h) => ({
        abiertaEn: h.abiertaEn,
        estado: h.estado,
        triage: h.triage,
        desenlace: h.desenlace,
        tipoEvento: h.tipoEvento,
        modalidad: h.emergencia.modalidad,
        firmada: h.firmaCierreId !== null,
        riesgoCaidaAlto: h.valoracionesDownton.length > 0,
        pacienteIdentificado: h.pacienteIdentificado,
        institucion: h.institucionDestino,
      })),
      servicios,
    };
  }

  async trazabilidad(
    historiaId: string,
    pagina: number,
    limite: number,
  ): Promise<ResultadoPaginado<EventoTrazabilidad>> {
    const where = { entidad: 'historias_clinicas', entidadId: historiaId };
    const [total, eventos] = await this.prisma.$transaction([
      this.prisma.auditoriaEvento.count({ where }),
      this.prisma.auditoriaEvento.findMany({
        where,
        orderBy: { creadoEn: 'asc' },
        skip: (pagina - 1) * limite,
        take: limite,
        select: {
          id: true,
          accion: true,
          detalle: true,
          creadoEn: true,
          usuario: {
            select: {
              id: true,
              nombres: true,
              apellidos: true,
              rol: { select: { nombre: true } },
            },
          },
        },
      }),
    ]);
    return {
      datos: eventos.map((e) => {
        const { direccionIp, detalle } = detalleSeguro(e.detalle);
        return {
          id: e.id,
          accion: e.accion,
          descripcion: DESCRIPCIONES_ACCION_HISTORIA[e.accion] ?? e.accion,
          tipo: tipoDeAccion(e.accion),
          ocurridoEn: e.creadoEn,
          usuario: e.usuario
            ? {
                id: e.usuario.id,
                nombreCompleto: `${e.usuario.nombres} ${e.usuario.apellidos}`,
                rol: e.usuario.rol.nombre,
              }
            : null,
          direccionIp,
          detalle,
        };
      }),
      total,
      pagina,
      limite,
    };
  }
}

// ---------------------------------------------------------------------------

function construirFiltro(
  f: FiltrosBusquedaHistorias,
): Prisma.HistoriaClinicaWhereInput {
  const y: Prisma.HistoriaClinicaWhereInput[] = [{ estado: { in: f.estados } }];
  if (f.rango.desde || f.rango.hastaExclusivo) {
    const rango: Prisma.DateTimeFilter = {
      ...(f.rango.desde && { gte: f.rango.desde }),
      ...(f.rango.hastaExclusivo && { lt: f.rango.hastaExclusivo }),
    };
    y.push(filtroFecha(f.campoFecha, rango));
  }
  if (f.ingreso) {
    y.push({ emergencia: { numeroEmergencia: { contains: f.ingreso } } });
  }
  if (f.numeroHistoria) {
    y.push({ numeroHistoria: { contains: f.numeroHistoria } });
  }
  if (f.documento) y.push({ numeroDocumento: f.documento });
  for (const palabra of f.palabrasNombre ?? []) {
    // Inicio de cualquier palabra de los nombres o los apellidos.
    y.push({
      OR: [
        { nombres: { startsWith: palabra } },
        { nombres: { contains: ` ${palabra}` } },
        { apellidos: { startsWith: palabra } },
        { apellidos: { contains: ` ${palabra}` } },
      ],
    });
  }
  if (f.soloNn) y.push({ pacienteIdentificado: false });
  if (f.triage) y.push({ triage: f.triage });
  if (f.desenlace) y.push({ desenlace: f.desenlace });
  if (f.tipoEvento) y.push({ tipoEvento: f.tipoEvento });
  if (f.riesgoCaidaAlto !== undefined) {
    y.push({
      valoracionesDownton: f.riesgoCaidaAlto
        ? { some: { nivelRiesgo: 'alto' } }
        : { none: { nivelRiesgo: 'alto' } },
    });
  }
  if (f.firmada !== undefined) {
    y.push({ firmaCierreId: f.firmada ? { not: null } : null });
  }
  if (f.ambulanciaId) y.push({ asignacion: { ambulanciaId: f.ambulanciaId } });
  if (f.institucionDestinoId) {
    y.push({ institucionDestinoId: f.institucionDestinoId });
  }
  if (f.profesionalId) {
    y.push({
      OR: [{ creadaPorId: f.profesionalId }, { cerradaPorId: f.profesionalId }],
    });
  }
  if (f.eps) y.push({ aseguradoraEps: { contains: f.eps } });
  if (f.regimen) y.push({ regimenAfiliacion: f.regimen });
  if (f.modalidad) y.push({ emergencia: { modalidad: f.modalidad } });
  return { AND: y };
}

function filtroFecha(
  campo: CampoFechaConsulta,
  rango: Prisma.DateTimeFilter,
): Prisma.HistoriaClinicaWhereInput {
  switch (campo) {
    case 'atencion':
      return { abiertaEn: rango };
    case 'evento':
      return { horaEvento: rango };
    case 'cierre':
      return { cerradaEn: rango };
  }
}

function ordenar(
  f: FiltrosBusquedaHistorias,
): Prisma.HistoriaClinicaOrderByWithRelationInput[] {
  const porFecha = (
    direccion: Prisma.SortOrder,
  ): Prisma.HistoriaClinicaOrderByWithRelationInput => {
    switch (f.campoFecha) {
      case 'atencion':
        return { abiertaEn: direccion };
      case 'evento':
        return { horaEvento: direccion };
      case 'cierre':
        return { cerradaEn: direccion };
    }
  };
  switch (f.orden) {
    case 'fecha_desc':
      return [porFecha('desc'), { numeroHistoria: 'desc' }];
    case 'fecha_asc':
      return [porFecha('asc'), { numeroHistoria: 'asc' }];
    case 'numero':
      return [{ numeroHistoria: 'desc' }];
    case 'paciente':
      return [{ apellidos: 'asc' }, { nombres: 'asc' }, { abiertaEn: 'desc' }];
  }
}

function aResumen(r: RegistroResumen): ResumenHistoriaConsulta {
  const estado = uno(ESTADOS_HISTORIA, r.estado);
  if (!estado) throw new Error(`Estado de historia desconocido: ${r.estado}`);
  return {
    id: r.id,
    numeroHistoria: r.numeroHistoria,
    estado,
    abiertaEn: r.abiertaEn,
    horaEvento: r.horaEvento,
    cerradaEn: r.cerradaEn,
    paciente: {
      identificado: r.pacienteIdentificado,
      nombres: r.nombres,
      apellidos: r.apellidos,
      tipoDocumento: uno(TIPOS_DOCUMENTO, r.tipoDocumento),
      numeroDocumento: r.numeroDocumento,
      sexo: uno(SEXOS, r.sexo),
      fechaNacimiento: r.fechaNacimiento,
      edadAproximada: r.edadAproximada,
      edadAnios: r.fechaNacimiento
        ? edadEnAnios(r.fechaNacimiento, r.abiertaEn)
        : r.edadAproximada,
    },
    triage: uno(TRIAGES, r.triage),
    desenlace: uno(DESENLACES, r.desenlace),
    tipoEvento: uno(TIPOS_EVENTO, r.tipoEvento),
    impresionDiagnostica: r.impresionDiagnostica,
    aseguradoraEps: r.aseguradoraEps,
    regimenAfiliacion: uno(REGIMENES_AFILIACION, r.regimenAfiliacion),
    ingreso: {
      emergenciaId: r.emergenciaId,
      numeroEmergencia: r.emergencia.numeroEmergencia,
      modalidad: modalidad(r.emergencia.modalidad),
    },
    ambulancia: r.asignacion?.ambulancia ?? null,
    institucionDestino: r.institucionDestino,
    creadaPor: persona(r.creadaPor) ?? {
      id: '',
      nombreCompleto: null,
    },
    cerradaPor: persona(r.cerradaPor),
    firmada: r.firmaCierreId !== null,
    riesgoCaidaAlto: r.valoracionesDownton.length > 0,
    totales: r._count,
  };
}

function aAsignacion(
  a: RegistroAsignacion,
  recibidaEn: Date,
  puntos: {
    latitud: Prisma.Decimal;
    longitud: Prisma.Decimal;
    velocidad: Prisma.Decimal | null;
    registradaEn: Date;
  }[],
): AsignacionIngreso {
  return {
    id: a.id,
    estado: a.estado,
    ambulancia: {
      id: a.ambulancia.id,
      codigo: a.ambulancia.codigo,
      placa: a.ambulancia.placa,
      tipo: a.ambulancia.tipoAmbulancia.nombre,
    },
    tripulacion: (a.turno?.integrantes ?? []).map((i) => ({
      usuarioId: i.usuario.id,
      nombreCompleto: `${i.usuario.nombres} ${i.usuario.apellidos}`,
      funcion: i.funcion,
    })),
    asignadaPor: persona(a.asignadaPor),
    asignadaEn: a.asignadaEn,
    salidaEn: a.salidaEn,
    llegadaEscenaEn: a.llegadaEscenaEn,
    atencionInicioEn: a.atencionInicioEn,
    salidaEscenaEn: a.salidaEscenaEn,
    llegadaDestinoEn: a.llegadaDestinoEn,
    finalizadaEn: a.finalizadaEn,
    motivoCancelacion: a.motivoCancelacion,
    institucionDestino: a.institucionDestino,
    tiempos: calcularTiemposServicio({ ...a, recibidaEn }),
    eventos: a.eventos.map((e) => ({
      estadoAnterior: e.estadoAnterior,
      estadoNuevo: e.estadoNuevo,
      ocurridoEn: e.ocurridoEn,
      usuario: persona(e.usuario),
      rolResponsable: e.rolResponsable,
      latitud: numero(e.latitud),
      longitud: numero(e.longitud),
      distanciaEscenaMetros: numero(e.distanciaEscenaMetros),
      fueraDeRadio: e.fueraDeRadio,
      observacion: e.observacion,
    })),
    recorrido: {
      puntos: muestrearRecorrido(puntos, PUNTOS_MAXIMOS_RECORRIDO).map((p) => ({
        latitud: p.latitud.toNumber(),
        longitud: p.longitud.toNumber(),
        velocidad: numero(p.velocidad),
        registradaEn: p.registradaEn,
      })),
      totalPuntos: puntos.length,
      muestreado: puntos.length > PUNTOS_MAXIMOS_RECORRIDO,
    },
    insumos: a.movimientosInventario.map((m) => ({
      id: m.id,
      codigo: m.codigo,
      tipo: m.tipo,
      estado: m.estado,
      realizadoEn: m.realizadoEn,
      registradoPor: persona(m.usuario) ?? { id: '', nombreCompleto: null },
      items: m.detalles.map((d) => ({
        insumoId: d.insumo.id,
        codigo: d.insumo.codigo,
        nombre: d.insumo.nombre,
        unidadMedida: d.insumo.unidadMedida,
        cantidad: d.cantidad.toNumber(),
        numeroLote: d.lote?.numeroLote ?? null,
        numeroSerie: d.equipo?.numeroSerie ?? null,
      })),
    })),
  };
}

/** Solo las claves conocidas del detalle (ver CLAVES_DETALLE_TRAZABILIDAD). */
function detalleSeguro(detalle: Prisma.JsonValue): {
  direccionIp: string | null;
  detalle: Record<string, unknown>;
} {
  if (!detalle || typeof detalle !== 'object' || Array.isArray(detalle)) {
    return { direccionIp: null, detalle: {} };
  }
  const seguro: Record<string, unknown> = {};
  for (const clave of CLAVES_DETALLE_TRAZABILIDAD) {
    if (clave in detalle) seguro[clave] = detalle[clave];
  }
  const ip = detalle['direccionIp'];
  return { direccionIp: typeof ip === 'string' ? ip : null, detalle: seguro };
}

function persona(
  u: { id: string; nombres: string; apellidos: string } | null,
): PersonaConsulta | null {
  return u ? { id: u.id, nombreCompleto: `${u.nombres} ${u.apellidos}` } : null;
}

function numero(valor: Prisma.Decimal | null): number | null {
  return valor === null ? null : valor.toNumber();
}

function modalidad(valor: string): ModalidadServicio {
  return uno(MODALIDADES_SERVICIO, valor) ?? 'emergencia';
}

/** Valores cargados con otro catálogo se muestran como null en vez de romper la lectura. */
function uno<T extends string>(
  validos: readonly T[],
  valor: string | null,
): T | null {
  return validos.find((v) => v === valor) ?? null;
}
