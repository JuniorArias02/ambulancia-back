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

try {
  await sembrarRoles();
  await sembrarTiposAmbulancia();
  await sembrarAdministrador();
} finally {
  await prisma.$disconnect();
}
