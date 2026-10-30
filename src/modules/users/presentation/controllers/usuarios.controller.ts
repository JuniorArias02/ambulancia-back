import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Roles } from '../../../../common/constants/roles.js';
import { Contexto } from '../../../../common/decorators/contexto.decorator.js';
import { RequiereRoles } from '../../../../common/decorators/requiere_roles.decorator.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { ActualizarUsuario } from '../../application/use-cases/actualizar_usuario.use-case.js';
import { AsignarRolUsuario } from '../../application/use-cases/asignar_rol_usuario.use-case.js';
import { CambiarEstadoUsuario } from '../../application/use-cases/cambiar_estado_usuario.use-case.js';
import { ConsultarUsuarios } from '../../application/use-cases/consultar_usuarios.use-case.js';
import { CrearUsuario } from '../../application/use-cases/crear_usuario.use-case.js';
import { ObtenerUsuario } from '../../application/use-cases/obtener_usuario.use-case.js';
import { ActualizarUsuarioDto } from '../dto/actualizar_usuario.dto.js';
import { AsignarRolUsuarioDto } from '../dto/asignar_rol_usuario.dto.js';
import { CambiarEstadoUsuarioDto } from '../dto/cambiar_estado_usuario.dto.js';
import { ConsultarUsuariosDto } from '../dto/consultar_usuarios.dto.js';
import { CrearUsuarioDto } from '../dto/crear_usuario.dto.js';
import {
  UsuarioRespuestaDto,
  UsuariosPaginadosRespuestaDto,
} from '../dto/usuario_respuesta.dto.js';

@ApiTags('Usuarios')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({ description: 'Sin permisos para la operación' })
@RequiereRoles(Roles.ADMINISTRADOR)
@Controller('usuarios')
export class UsuariosController {
  constructor(
    private readonly crearUsuario: CrearUsuario,
    private readonly consultarUsuarios: ConsultarUsuarios,
    private readonly obtenerUsuario: ObtenerUsuario,
    private readonly actualizarUsuario: ActualizarUsuario,
    private readonly cambiarEstadoUsuario: CambiarEstadoUsuario,
    private readonly asignarRolUsuario: AsignarRolUsuario,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear un usuario con su rol' })
  @ApiCreatedResponse({ type: UsuarioRespuestaDto })
  @ApiConflictResponse({ description: 'El correo ya está registrado' })
  @ApiUnprocessableEntityResponse({ description: 'Rol inexistente' })
  async crear(
    @Body() dto: CrearUsuarioDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<UsuarioRespuestaDto> {
    const usuario = await this.crearUsuario.ejecutar(dto, contexto);
    return UsuarioRespuestaDto.desde(usuario);
  }

  @Get()
  @ApiOperation({ summary: 'Consultar usuarios con filtros y paginación' })
  @ApiOkResponse({ type: UsuariosPaginadosRespuestaDto })
  async consultar(
    @Query() { pagina, limite, ...filtros }: ConsultarUsuariosDto,
  ): Promise<UsuariosPaginadosRespuestaDto> {
    const resultado = await this.consultarUsuarios.ejecutar(filtros, {
      pagina,
      limite,
    });
    return UsuariosPaginadosRespuestaDto.desde(resultado);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un usuario' })
  @ApiOkResponse({ type: UsuarioRespuestaDto })
  @ApiNotFoundResponse()
  async obtener(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UsuarioRespuestaDto> {
    return UsuarioRespuestaDto.desde(await this.obtenerUsuario.ejecutar(id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar los datos personales de un usuario' })
  @ApiOkResponse({ type: UsuarioRespuestaDto })
  @ApiNotFoundResponse()
  async actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarUsuarioDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<UsuarioRespuestaDto> {
    const usuario = await this.actualizarUsuario.ejecutar(id, dto, contexto);
    return UsuarioRespuestaDto.desde(usuario);
  }

  @Patch(':id/estado')
  @ApiOperation({ summary: 'Activar, inactivar o bloquear un usuario' })
  @ApiOkResponse({ type: UsuarioRespuestaDto })
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse({
    description: 'Mismo estado actual o intento de cambiar el propio estado',
  })
  async cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoUsuarioDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<UsuarioRespuestaDto> {
    const usuario = await this.cambiarEstadoUsuario.ejecutar(
      { usuarioId: id, estado: dto.estado, motivo: dto.motivo },
      contexto,
    );
    return UsuarioRespuestaDto.desde(usuario);
  }

  @Put(':id/rol')
  @ApiOperation({ summary: 'Cambiar el rol de un usuario' })
  @ApiOkResponse({ type: UsuarioRespuestaDto })
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse({
    description: 'Intento de retirarse el propio rol de administrador',
  })
  async asignarRol(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarRolUsuarioDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<UsuarioRespuestaDto> {
    const usuario = await this.asignarRolUsuario.ejecutar(
      id,
      dto.rol,
      contexto,
    );
    return UsuarioRespuestaDto.desde(usuario);
  }
}
