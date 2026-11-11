/**
 * Sincroniza los roles base y crea el administrador inicial si no existe.
 * Es idempotente: no modifica contraseñas ni roles de usuarios existentes.
 */
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import argon2 from 'argon2';
import { Roles, type NombreRol } from '../src/common/constants/roles.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

const DESCRIPCIONES_ROLES: Record<NombreRol, string> = {
  [Roles.ADMINISTRADOR]: 'Administración general del sistema',
  [Roles.DESPACHADOR]:
    'Recibe las alertas de emergencia y despacha las ambulancias',
  [Roles.PARAMEDICO]: 'Atiende al paciente y diligencia la historia clínica',
  [Roles.CONDUCTOR]: 'Conduce la ambulancia asignada',
  [Roles.CIUDADANO]:
    'Reporta emergencias desde la app una vez verificada su identidad',
};

function variableRequerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}`);
  return valor;
}

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(variableRequerida('DATABASE_URL')),
});

async function sembrarRoles(): Promise<void> {
  for (const [nombre, descripcion] of Object.entries(DESCRIPCIONES_ROLES)) {
    await prisma.rol.upsert({
      where: { nombre },
      update: { descripcion },
      create: { id: crypto.randomUUID(), nombre, descripcion },
    });
  }
}

const TIPOS_AMBULANCIA_BASE: Record<string, string> = {
  TAB: 'Transporte Asistencial Básico',
  TAM: 'Transporte Asistencial Medicalizado',
};

async function sembrarTiposAmbulancia(): Promise<void> {
  for (const [nombre, descripcion] of Object.entries(TIPOS_AMBULANCIA_BASE)) {
    await prisma.tipoAmbulancia.upsert({
      where: { nombre },
      update: { descripcion },
      create: { id: crypto.randomUUID(), nombre, descripcion },
    });
  }
}

async function sembrarAdministrador(): Promise<void> {
  const correo = variableRequerida('SEMILLA_ADMIN_CORREO').trim().toLowerCase();
  const existente = await prisma.usuario.findUnique({ where: { correo } });
  if (existente) {
    console.info(`El administrador ${correo} ya existe; no se modifica.`);
    return;
  }

  await prisma.usuario.create({
    data: {
      id: crypto.randomUUID(),
      nombres: 'Administrador',
      apellidos: 'Sistema',
      correo,
      contrasenaHash: await argon2.hash(
        variableRequerida('SEMILLA_ADMIN_CONTRASENA'),
        {
          type: argon2.argon2id,
        },
      ),
      rol: { connect: { nombre: Roles.ADMINISTRADOR } },
    },
  });
  console.info(`Administrador inicial creado: ${correo}`);
}

const NOMBRE_LISTA_CHEQUEO_BASE = 'Lista de chequeo diaria de ambulancia';

/** Revisión básica antes del turno: vehículo primero y luego equipo médico. */
const PREGUNTAS_CHEQUEO_BASE = [
  '¿Nivel de aceite del motor?',
  '¿Nivel de refrigerante y líquido de frenos?',
  '¿Combustible suficiente (mínimo medio tanque)?',
  '¿Llantas: presión, estado y repuesto?',
  '¿Frenos y freno de mano?',
  '¿Luces delanteras, traseras y direccionales?',
  '¿Luces de emergencia (balizas) y sirena?',
  '¿Batería, arranque y tablero sin alertas?',
  '¿Limpiaparabrisas, espejos y pito?',
  '¿Cinturones de seguridad (cabina y compartimiento del paciente)?',
  '¿Camilla principal y sus anclajes?',
  '¿Oxígeno: cilindros con carga y reguladores?',
  '¿Desfibrilador (DEA) con batería y electrodos?',
  '¿Botiquín y medicamentos completos y vigentes?',
  '¿Extintor cargado y vigente?',
];

const OPCIONES_CHEQUEO_BASE = [
  { nombre: 'Bien', valor: 2 },
  { nombre: 'Regular', valor: 1 },
  { nombre: 'Estable', valor: 0 },
];

/**
 * Crea la lista base si no existe. Solo la activa si no hay otra activa: nunca
 * le quita el lugar a una lista que ya configuró el administrador.
 */
async function sembrarListaChequeo(): Promise<void> {
  const existente = await prisma.listaChequeo.findFirst({
    where: { nombre: NOMBRE_LISTA_CHEQUEO_BASE },
  });
  if (existente) {
    console.info('La lista de chequeo base ya existe; no se modifica.');
    return;
  }

  const correo = variableRequerida('SEMILLA_ADMIN_CORREO').trim().toLowerCase();
  const administrador = await prisma.usuario.findUniqueOrThrow({
    where: { correo },
    select: { id: true },
  });
  const hayActiva =
    (await prisma.listaChequeo.count({ where: { activa: true } })) > 0;

  await prisma.listaChequeo.create({
    data: {
      id: crypto.randomUUID(),
      nombre: NOMBRE_LISTA_CHEQUEO_BASE,
      descripcion: 'Revisión básica del vehículo y del equipo antes del turno',
      activa: !hayActiva,
      creadaPorId: administrador.id,
      items: {
        create: PREGUNTAS_CHEQUEO_BASE.map((pregunta, orden) => ({
          id: crypto.randomUUID(),
          pregunta,
          orden,
          obligatorio: true,
          permiteObservacion: true,
        })),
      },
      estados: {
        create: OPCIONES_CHEQUEO_BASE.map((opcion, orden) => ({
          id: crypto.randomUUID(),
          ...opcion,
          orden,
        })),
      },
    },
  });
  console.info(
    `Lista de chequeo base creada (${PREGUNTAS_CHEQUEO_BASE.length} preguntas, ${hayActiva ? 'inactiva: ya había otra activa' : 'activa'}).`,
  );
}

try {
  await sembrarRoles();
  await sembrarTiposAmbulancia();
  await sembrarAdministrador();
  await sembrarListaChequeo();
} finally {
  await prisma.$disconnect();
}
