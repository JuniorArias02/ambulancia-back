/**
 * Servicios de DEMOSTRACIÓN de atención prehospitalaria, para desarrollo y
 * pruebas. Nunca en producción.
 *
 * Crea personal, ambulancias e instituciones demo y recorre 14 servicios desde
 * la llamada hasta la historia clínica cerrada y firmada, repartidos en los
 * últimos 30 días (escenarios en `semillas/aph_demo/escenarios.ts`).
 *
 * No escribe en la BD a mano: ejecuta los mismos casos de uso que el front y
 * la app. Así quedan bien los estados, los eventos, la auditoría, el índice de
 * pacientes, las firmas cifradas y la huella de cada historia.
 *
 * Requiere `npm run db:semilla` y la variable `SEMILLA_DEMO_CONTRASENA`.
 * Uso: `npm run db:semilla:aph-demo`. Un escenario que ya existe se salta.
 */
import 'dotenv/config';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Roles, type NombreRol } from '../src/common/constants/roles.js';
import type { ContextoSolicitud } from '../src/common/types/contexto_solicitud.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { CrearAmbulancia } from '../src/modules/ambulances/application/use-cases/crear_ambulancia.use-case.js';
import { SeleccionarAmbulancia } from '../src/modules/ambulances/application/use-cases/seleccionar_ambulancia.use-case.js';
import { AvanzarAsignacion } from '../src/modules/assignments/application/use-cases/avanzar_asignacion.use-case.js';
import { CancelarAsignacion } from '../src/modules/assignments/application/use-cases/cancelar_asignacion.use-case.js';
import { DespacharAmbulancia } from '../src/modules/assignments/application/use-cases/despachar_ambulancia.use-case.js';
import { CancelarEmergencia } from '../src/modules/emergencies/application/use-cases/cancelar_emergencia.use-case.js';
import { RegistrarEmergencia } from '../src/modules/emergencies/application/use-cases/registrar_emergencia.use-case.js';
import { AbrirHistoriaClinica } from '../src/modules/prehospital_care/application/use-cases/abrir_historia_clinica.use-case.js';
import { ActualizarHistoriaClinica } from '../src/modules/prehospital_care/application/use-cases/actualizar_historia_clinica.use-case.js';
import { CerrarHistoriaClinica } from '../src/modules/prehospital_care/application/use-cases/cerrar_historia_clinica.use-case.js';
import { CrearInstitucionSalud } from '../src/modules/prehospital_care/application/use-cases/crear_institucion_salud.use-case.js';
import { DefinirDestinoAsignacion } from '../src/modules/prehospital_care/application/use-cases/definir_destino_asignacion.use-case.js';
import { RegistrarEnHistoria } from '../src/modules/prehospital_care/application/use-cases/registrar_en_historia.use-case.js';
import { RegistrarFirmaHistoria } from '../src/modules/prehospital_care/application/use-cases/registrar_firma_historia.use-case.js';
import { RegistrarValoracionDownton } from '../src/modules/prehospital_care/application/use-cases/registrar_valoracion_downton.use-case.js';
import type { MedicionesSignoVital } from '../src/modules/prehospital_care/domain/entities/registros_clinicos.js';
import { RegistrarMiFirma } from '../src/modules/signatures/application/use-cases/registrar_mi_firma.use-case.js';
import { CrearUsuario } from '../src/modules/users/application/use-cases/crear_usuario.use-case.js';
import { POLITICA_CONTRASENA } from '../src/modules/users/presentation/dto/validaciones_usuario.js';
import {
  ESCENARIOS,
  type EscenarioDemo,
  type HistoriaDemo,
  type InstitucionDemo,
  type TipoAmbulanciaDemo,
} from './semillas/aph_demo/escenarios.js';
import { dibujarFirma } from './semillas/aph_demo/firma_png.js';
import {
  haceDiasEnColombia,
  reloj,
} from './semillas/aph_demo/reloj_simulado.js';

if (process.env['NODE_ENV'] === 'production') {
  throw new Error(
    'La semilla de demostración de APH no se ejecuta en producción.',
  );
}

function variableRequerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}`);
  return valor;
}

const CONTRASENA = variableRequerida('SEMILLA_DEMO_CONTRASENA');
if (
  CONTRASENA.length < POLITICA_CONTRASENA.longitudMinima ||
  !POLITICA_CONTRASENA.patron.test(CONTRASENA)
) {
  throw new Error(
    `SEMILLA_DEMO_CONTRASENA: mínimo ${POLITICA_CONTRASENA.longitudMinima} caracteres. ${POLITICA_CONTRASENA.mensaje}`,
  );
}

// Sin servicios externos: ni rutas (Geoapify cobra por consulta) ni avisos de
// tiempo real. Debe ir antes de cargar AppModule, que lee la configuración.
process.env['GEOAPIFY_API_KEY'] = '';
process.env['TIEMPO_REAL_URL'] = '';

// ---------------------------------------------------------------- Personal

interface PersonaDemo {
  nombres: string;
  apellidos: string;
  correo: string;
  rol: NombreRol;
}

const PERSONAL = {
  despachador: {
    nombres: 'Laura Marcela',
    apellidos: 'Gómez Demo',
    correo: 'despachador@demo.local',
    rol: Roles.DESPACHADOR,
  },
  conductorTab: {
    nombres: 'Wilmer',
    apellidos: 'Jaimes Demo',
    correo: 'conductor.tab@demo.local',
    rol: Roles.CONDUCTOR,
  },
  paramedicoTab: {
    nombres: 'Diana Carolina',
    apellidos: 'Rincón Demo',
    correo: 'paramedico.tab@demo.local',
    rol: Roles.PARAMEDICO,
  },
  conductorTam: {
    nombres: 'Fabián',
    apellidos: 'Contreras Demo',
    correo: 'conductor.tam@demo.local',
    rol: Roles.CONDUCTOR,
  },
  paramedicoTam: {
    nombres: 'Julián Andrés',
    apellidos: 'Peñaranda Demo',
    correo: 'paramedico.tam@demo.local',
    rol: Roles.PARAMEDICO,
  },
} as const satisfies Record<string, PersonaDemo>;

type ClavePersona = keyof typeof PERSONAL;

const AMBULANCIAS: Record<
  TipoAmbulanciaDemo,
  {
    codigo: string;
    placa: string;
    conductor: ClavePersona;
    paramedico: ClavePersona;
  }
> = {
  TAB: {
    codigo: 'DEMO-TAB',
    placa: 'DEM001',
    conductor: 'conductorTab',
    paramedico: 'paramedicoTab',
  },
  TAM: {
    codigo: 'DEMO-TAM',
    placa: 'DEM002',
    conductor: 'conductorTam',
    paramedico: 'paramedicoTam',
  },
};

const INSTITUCIONES: Record<
  InstitucionDemo,
  {
    nombre: string;
    direccion: string;
    telefono: string;
    latitud: number;
    longitud: number;
  }
> = {
  norte: {
    nombre: 'Clínica Demo Norte',
    direccion: 'Avenida 4 # 25-60, barrio Prados del Norte',
    telefono: '3000000901',
    latitud: 7.9208,
    longitud: -72.5021,
  },
  central: {
    nombre: 'Hospital Demo Central',
    direccion: 'Avenida 0 # 10-50, barrio Centro',
    telefono: '3000000902',
    latitud: 7.8862,
    longitud: -72.4979,
  },
};

// ---------------------------------------------------------------- Preparación

interface Tripulacion {
  ambulanciaId: string;
  conductor: ContextoSolicitud;
  paramedico: ContextoSolicitud;
}

interface Preparacion {
  despachador: ContextoSolicitud;
  tripulaciones: Record<TipoAmbulanciaDemo, Tripulacion>;
  instituciones: Record<InstitucionDemo, string>;
}

const contexto = (usuarioId: string, rol: NombreRol): ContextoSolicitud => ({
  usuarioId,
  rol,
  direccionIp: null,
});

const PROCESO_INTERNO: ContextoSolicitud = {
  usuarioId: null,
  direccionIp: null,
};

async function preparar(app: INestApplicationContext): Promise<Preparacion> {
  const prisma = app.get(PrismaService);

  const ids = {} as Record<ClavePersona, string>;
  for (const [clave, persona] of Object.entries(PERSONAL) as [
    ClavePersona,
    PersonaDemo,
  ][]) {
    const existente = await prisma.usuario.findUnique({
      where: { correo: persona.correo },
      select: { id: true },
    });
    ids[clave] =
      existente?.id ??
      (
        await app
          .get(CrearUsuario)
          .ejecutar({ ...persona, contrasena: CONTRASENA }, PROCESO_INTERNO)
      ).id;
  }

  const instituciones = {} as Record<InstitucionDemo, string>;
  for (const [clave, datos] of Object.entries(INSTITUCIONES) as [
    InstitucionDemo,
    (typeof INSTITUCIONES)[InstitucionDemo],
  ][]) {
    const existente = await prisma.institucionSalud.findFirst({
      where: { nombre: datos.nombre },
      select: { id: true },
    });
    instituciones[clave] =
      existente?.id ??
      (
        await app
          .get(CrearInstitucionSalud)
          .ejecutar({ ...datos, nivelComplejidad: 'alta' }, PROCESO_INTERNO)
      ).id;
  }

  const tripulaciones = {} as Record<TipoAmbulanciaDemo, Tripulacion>;
  for (const [tipo, datos] of Object.entries(AMBULANCIAS) as [
    TipoAmbulanciaDemo,
    (typeof AMBULANCIAS)[TipoAmbulanciaDemo],
  ][]) {
    let ambulanciaId = (
      await prisma.ambulancia.findUnique({
        where: { codigo: datos.codigo },
        select: { id: true },
      })
    )?.id;
    if (!ambulanciaId) {
      const tipoAmbulancia = await prisma.tipoAmbulancia.findUnique({
        where: { nombre: tipo },
        select: { id: true },
      });
      if (!tipoAmbulancia) {
        throw new Error(
          `Falta el tipo ${tipo}: ejecute antes npm run db:semilla`,
        );
      }
      ambulanciaId = (
        await app.get(CrearAmbulancia).ejecutar(
          {
            codigo: datos.codigo,
            placa: datos.placa,
            tipoAmbulanciaId: tipoAmbulancia.id,
          },
          PROCESO_INTERNO,
        )
      ).id;
    }

    const conductor = contexto(ids[datos.conductor], Roles.CONDUCTOR);
    const paramedico = contexto(ids[datos.paramedico], Roles.PARAMEDICO);
    // Cada uno selecciona su ambulancia, como en la app: el turno queda activo.
    for (const integrante of [conductor, paramedico]) {
      const enTurno = await prisma.turnoIntegrante.findFirst({
        where: {
          usuarioId: integrante.usuarioId ?? '',
          turno: { estado: 'activo' },
        },
        select: { turnoId: true },
      });
      if (!enTurno) {
        await app.get(SeleccionarAmbulancia).ejecutar(ambulanciaId, integrante);
      }
    }
    tripulaciones[tipo] = { ambulanciaId, conductor, paramedico };
  }

  // El paramédico registra su firma una vez; se estampa en cada cierre.
  for (const clave of ['paramedicoTab', 'paramedicoTam'] as const) {
    const usuarioId = ids[clave];
    const vigente = await prisma.firmaUsuario.findFirst({
      where: { usuarioId, vigente: true },
      select: { id: true },
    });
    if (!vigente) {
      const persona = PERSONAL[clave];
      await app.get(RegistrarMiFirma).ejecutar(
        {
          imagen: dibujarFirma(`${persona.nombres} ${persona.apellidos}`),
          contrasena: CONTRASENA,
        },
        contexto(usuarioId, Roles.PARAMEDICO),
      );
    }
  }

  return {
    despachador: contexto(ids.despachador, Roles.DESPACHADOR),
    tripulaciones,
    instituciones,
  };
}

// ---------------------------------------------------------------- Servicios

const SIGNO_VACIO: MedicionesSignoVital = {
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

interface Resultado {
  codigo: string;
  emergencia: string;
  historia: string | null;
  estado: string;
}

function inicioDe(escenario: EscenarioDemo, ahoraReal: number): Date {
  return escenario.haceDias === null
    ? new Date(ahoraReal - (escenario.minutosAtras ?? 0) * 60_000)
    : haceDiasEnColombia(escenario.haceDias, escenario.hora ?? '12:00');
}

async function recorrerServicio(
  app: INestApplicationContext,
  escenario: EscenarioDemo,
  preparacion: Preparacion,
): Promise<Resultado> {
  const { despachador } = preparacion;
  const tripulacion = preparacion.tripulaciones[escenario.ambulancia];
  const { conductor, paramedico } = tripulacion;
  const punto = {
    latitud: escenario.emergencia.latitud,
    longitud: escenario.emergencia.longitud,
  };

  const emergencia = await app.get(RegistrarEmergencia).ejecutar(
    {
      ...escenario.emergencia,
      descripcion: `[${escenario.codigo}] ${escenario.emergencia.descripcion}`,
    },
    despachador,
  );
  const resultado = (
    estado: string,
    historia: string | null = null,
  ): Resultado => ({
    codigo: escenario.codigo,
    emergencia: emergencia.numeroEmergencia,
    historia,
    estado,
  });
  if (escenario.alcance === 'recibida')
    return resultado('recibida, sin despachar');

  reloj.avanzar(2);
  const asignacion = await app
    .get(DespacharAmbulancia)
    .ejecutar(
      { emergenciaId: emergencia.id, ambulanciaId: tripulacion.ambulanciaId },
      despachador,
    );
  const avanzar = app.get(AvanzarAsignacion);
  reloj.avanzar(1);
  await avanzar.ejecutar(
    {
      asignacionId: asignacion.id,
      estado: 'en_camino',
      rolSolicitante: Roles.CONDUCTOR,
    },
    conductor,
  );

  if (escenario.alcance === 'cancelada') {
    const motivo = escenario.motivoCancelacion ?? 'Cancelada por la central';
    reloj.avanzar(6);
    await app
      .get(CancelarAsignacion)
      .ejecutar({ asignacionId: asignacion.id, motivo }, despachador);
    reloj.avanzar(1);
    await app
      .get(CancelarEmergencia)
      .ejecutar({ emergenciaId: emergencia.id, motivo }, despachador);
    return resultado('asignación y emergencia canceladas');
  }

  reloj.avanzar(9);
  await avanzar.ejecutar(
    {
      asignacionId: asignacion.id,
      estado: 'en_escena',
      rolSolicitante: Roles.CONDUCTOR,
      posicion: punto,
      precisionMetros: 8,
    },
    conductor,
  );

  const datosHistoria = escenario.historia;
  if (!datosHistoria) throw new Error(`${escenario.codigo}: falta la historia`);
  reloj.avanzar(2);
  const { detalle } = await app
    .get(AbrirHistoriaClinica)
    .ejecutar(
      { asignacionId: asignacion.id, datosIniciales: datosHistoria.paciente },
      paramedico,
    );
  const historiaId = detalle.historia.id;
  const numeroHistoria = detalle.historia.numeroHistoria;
  reloj.avanzar(1);
  await avanzar.ejecutar(
    {
      asignacionId: asignacion.id,
      estado: 'atendiendo',
      rolSolicitante: Roles.PARAMEDICO,
    },
    paramedico,
  );
  await diligenciarHistoria(
    app,
    historiaId,
    datosHistoria,
    emergencia.recibidaEn,
    paramedico,
  );

  if (escenario.alcance === 'en_curso') {
    return resultado('atendiendo, historia abierta', numeroHistoria);
  }

  const { entrega } = datosHistoria;
  if (entrega) {
    reloj.avanzar(3);
    await app
      .get(DefinirDestinoAsignacion)
      .ejecutar(
        asignacion.id,
        preparacion.instituciones[entrega.institucion],
        { usuarioId: conductor.usuarioId, rol: Roles.CONDUCTOR },
        conductor,
      );
    reloj.avanzar(1);
    await avanzar.ejecutar(
      {
        asignacionId: asignacion.id,
        estado: 'trasladando',
        rolSolicitante: Roles.CONDUCTOR,
      },
      conductor,
    );
    reloj.avanzar(18);
    await avanzar.ejecutar(
      {
        asignacionId: asignacion.id,
        estado: 'finalizada',
        rolSolicitante: Roles.CONDUCTOR,
      },
      conductor,
    );
    await app.get(ActualizarHistoriaClinica).ejecutar(
      historiaId,
      {
        institucionDestinoId: preparacion.instituciones[entrega.institucion],
        condicionEntrega: entrega.condicionEntrega,
        receptorNombre: entrega.receptorNombre,
        receptorCargo: entrega.receptorCargo,
      },
      paramedico,
    );
  } else {
    reloj.avanzar(12);
    await avanzar.ejecutar(
      {
        asignacionId: asignacion.id,
        estado: 'finalizada',
        rolSolicitante: Roles.CONDUCTOR,
        observacion:
          datosHistoria.observacionCierreServicio ?? 'Servicio sin traslado',
      },
      conductor,
    );
  }

  const nombrePaciente = [
    datosHistoria.paciente.nombres,
    datosHistoria.paciente.apellidos,
  ]
    .filter(Boolean)
    .join(' ');
  for (const firma of datosHistoria.firmas) {
    reloj.avanzar(1);
    await app.get(RegistrarFirmaHistoria).ejecutar(
      historiaId,
      {
        ...firma,
        imagen: firma.motivoSinFirma
          ? undefined
          : dibujarFirma(firma.nombreFirmante ?? nombrePaciente),
      },
      paramedico,
    );
  }

  reloj.avanzar(2);
  await app
    .get(CerrarHistoriaClinica)
    .ejecutar(
      historiaId,
      { contrasena: CONTRASENA, aceptaDeclaracion: true },
      paramedico,
    );
  return resultado('historia cerrada y firmada', numeroHistoria);
}

/** Lo que llena el paramédico en la escena: valoración, signos, lesiones, tratamiento. */
async function diligenciarHistoria(
  app: INestApplicationContext,
  historiaId: string,
  datos: HistoriaDemo,
  recibidaEn: Date,
  paramedico: ContextoSolicitud,
): Promise<void> {
  const registrar = app.get(RegistrarEnHistoria);
  for (const lesion of datos.lesiones ?? []) {
    reloj.avanzar(1);
    await registrar.lesion(historiaId, lesion, paramedico);
  }
  for (const signo of datos.signos) {
    reloj.avanzar(3);
    await registrar.signoVital(
      historiaId,
      { mediciones: { ...SIGNO_VACIO, ...signo } },
      paramedico,
    );
  }
  for (const intervencion of datos.intervenciones ?? []) {
    reloj.avanzar(2);
    await registrar.intervencion(historiaId, intervencion, paramedico);
  }
  if (datos.downton) {
    reloj.avanzar(2);
    await app
      .get(RegistrarValoracionDownton)
      .ejecutar(historiaId, { respuestas: datos.downton }, paramedico);
  }
  reloj.avanzar(2);
  await app.get(ActualizarHistoriaClinica).ejecutar(
    historiaId,
    // El evento ocurrió unos minutos antes de la llamada.
    {
      ...datos.clinica,
      horaEvento: new Date(recibidaEn.getTime() - 8 * 60_000),
    },
    paramedico,
  );
}

// ---------------------------------------------------------------- Ejecución

async function principal(): Promise<void> {
  const ahoraReal = Date.now();
  const { AppModule } = await import('../src/app.module.js');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  reloj.instalar();

  try {
    reloj.en(haceDiasEnColombia(31, '06:00'));
    const preparacion = await preparar(app);

    const resultados: Resultado[] = [];
    for (const escenario of ESCENARIOS) {
      const existente = await prisma.emergencia.findFirst({
        where: { descripcion: { startsWith: `[${escenario.codigo}]` } },
        select: { numeroEmergencia: true },
      });
      if (existente) {
        resultados.push({
          codigo: escenario.codigo,
          emergencia: existente.numeroEmergencia,
          historia: null,
          estado: 'ya existía, no se modifica',
        });
        continue;
      }
      reloj.en(inicioDe(escenario, ahoraReal));
      try {
        resultados.push(await recorrerServicio(app, escenario, preparacion));
      } catch (error) {
        throw new Error(
          `${escenario.codigo} falló: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
      }
    }

    console.table(resultados);
    console.info(
      `Usuarios demo (${Object.values(PERSONAL)
        .map((p) => p.correo)
        .join(', ')}) con la contraseña de SEMILLA_DEMO_CONTRASENA.`,
    );
  } finally {
    // Los suscriptores del bus de eventos corren en segundo plano: se les da
    // un momento para terminar antes de cerrar la conexión a la BD.
    await new Promise((listo) => setTimeout(listo, 1500));
    reloj.restablecer();
    await app.close();
  }
}

await principal();
