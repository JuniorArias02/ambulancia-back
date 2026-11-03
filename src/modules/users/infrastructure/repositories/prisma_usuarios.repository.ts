import { Injectable } from '@nestjs/common';
import { esRolValido } from '../../../../common/constants/roles.js';
import {
  ConflictoNegocioError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import { PrismaService } from '../../../../database/prisma.service.js';
import { Prisma } from '../../../../generated/prisma/client.js';
import { Usuario } from '../../domain/entities/usuario.entity.js';
import {
  type FiltrosUsuarios,
  UsuariosRepositorio,
} from '../../domain/repositories/usuarios.repository.js';

const seleccionUsuario = {
  id: true,
  nombres: true,
  apellidos: true,
  correo: true,
  telefono: true,
  contrasenaHash: true,
  estado: true,
  ultimoAcceso: true,
  creadoEn: true,
  rol: { select: { nombre: true } },
} satisfies Prisma.UsuarioSelect;

type RegistroUsuario = Prisma.UsuarioGetPayload<{
  select: typeof seleccionUsuario;
}>;

@Injectable()
export class PrismaUsuariosRepositorio extends UsuariosRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async buscarPorId(id: string): Promise<Usuario | null> {
    const registro = await this.prisma.usuario.findUnique({
      where: { id },
      select: seleccionUsuario,
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async buscarPorCorreo(correo: string): Promise<Usuario | null> {
    const registro = await this.prisma.usuario.findUnique({
      where: { correo },
      select: seleccionUsuario,
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async buscarPorDocumento(numeroDocumento: string): Promise<Usuario | null> {
    const registro = await this.prisma.usuario.findUnique({
      where: { numeroDocumento },
      select: seleccionUsuario,
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async existeCorreo(correo: string): Promise<boolean> {
    const total = await this.prisma.usuario.count({ where: { correo } });
    return total > 0;
  }

  async listar(
    filtros: FiltrosUsuarios,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<Usuario>> {
    const where: Prisma.UsuarioWhereInput = {
      estado: filtros.estado,
      rol: filtros.rol ? { nombre: filtros.rol } : undefined,
      OR: filtros.busqueda
        ? [
            { nombres: { contains: filtros.busqueda } },
            { apellidos: { contains: filtros.busqueda } },
            { correo: { contains: filtros.busqueda } },
          ]
        : undefined,
    };

    const [total, registros] = await this.prisma.$transaction([
      this.prisma.usuario.count({ where }),
      this.prisma.usuario.findMany({
        where,
        select: seleccionUsuario,
        orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
        skip: (pagina - 1) * limite,
        take: limite,
      }),
    ]);

    return {
      datos: registros.map((registro) => this.aEntidad(registro)),
      total,
      pagina,
      limite,
    };
  }

  async crear(usuario: Usuario): Promise<Usuario> {
    try {
      const registro = await this.prisma.usuario.create({
        data: {
          id: usuario.id,
          nombres: usuario.nombres,
          apellidos: usuario.apellidos,
          correo: usuario.correo,
          telefono: usuario.telefono,
          contrasenaHash: usuario.contrasenaHash,
          estado: usuario.estado,
          creadoEn: usuario.creadoEn,
          rol: { connect: { nombre: usuario.rol } },
        },
        select: seleccionUsuario,
      });
      return this.aEntidad(registro);
    } catch (error) {
      throw this.traducirError(error);
    }
  }

  async actualizar(usuario: Usuario): Promise<Usuario> {
    try {
      const registro = await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          nombres: usuario.nombres,
          apellidos: usuario.apellidos,
          telefono: usuario.telefono,
          contrasenaHash: usuario.contrasenaHash,
          estado: usuario.estado,
          rol: { connect: { nombre: usuario.rol } },
        },
        select: seleccionUsuario,
      });
      return this.aEntidad(registro);
    } catch (error) {
      throw this.traducirError(error);
    }
  }

  async registrarAcceso(usuarioId: string, fecha: Date): Promise<void> {
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { ultimoAcceso: fecha },
      select: { id: true },
    });
  }

  private aEntidad(registro: RegistroUsuario): Usuario {
    if (!Usuario.esEstadoValido(registro.estado)) {
      throw new Error(
        `Estado de usuario desconocido en la base de datos: ${registro.estado}`,
      );
    }
    if (!esRolValido(registro.rol.nombre)) {
      throw new Error(
        `Rol de usuario desconocido en la base de datos: ${registro.rol.nombre}`,
      );
    }

    return Usuario.reconstruir({
      id: registro.id,
      nombres: registro.nombres,
      apellidos: registro.apellidos,
      correo: registro.correo,
      telefono: registro.telefono,
      contrasenaHash: registro.contrasenaHash,
      estado: registro.estado,
      rol: registro.rol.nombre,
      ultimoAcceso: registro.ultimoAcceso,
      creadoEn: registro.creadoEn,
    });
  }

  private traducirError(error: unknown): unknown {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return error;
    if (error.code === 'P2002') {
      return new ConflictoNegocioError('Ya existe un usuario con ese correo');
    }
    // El rol a conectar no existe en la tabla roles (seed sin ejecutar).
    if (error.code === 'P2025') {
      return new ReglaNegocioError('El rol indicado no está registrado');
    }
    return error;
  }
}
