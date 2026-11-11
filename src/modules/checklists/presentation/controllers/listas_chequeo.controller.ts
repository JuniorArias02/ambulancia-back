import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { ActualizarListaChequeo } from '../../application/use-cases/actualizar_lista_chequeo.use-case.js';
import { CambiarEstadoListaChequeo } from '../../application/use-cases/cambiar_estado_lista_chequeo.use-case.js';
import { ConsultarListasChequeo } from '../../application/use-cases/consultar_listas_chequeo.use-case.js';
import { CrearListaChequeo } from '../../application/use-cases/crear_lista_chequeo.use-case.js';
import { GestionarOpcionesListaChequeo } from '../../application/use-cases/gestionar_opciones_lista_chequeo.use-case.js';
import { GestionarPreguntasListaChequeo } from '../../application/use-cases/gestionar_preguntas_lista_chequeo.use-case.js';
import {
  ActualizarListaChequeoDto,
  CambiarEstadoListaChequeoDto,
} from '../dto/actualizar_lista_chequeo.dto.js';
import { ConsultarListasChequeoDto } from '../dto/consultar_listas_chequeo.dto.js';
import {
  CrearListaChequeoDto,
  CrearOpcionDto,
  CrearPreguntaDto,
} from '../dto/crear_lista_chequeo.dto.js';
import {
  ListaChequeoRespuestaDto,
  ListasChequeoPaginadasRespuestaDto,
} from '../dto/lista_chequeo_respuesta.dto.js';
import {
  ActualizarOpcionDto,
  ActualizarPreguntaDto,
} from '../dto/preguntas_opciones.dto.js';

/** Configuración de la lista: solo el administrador. Nada se borra, se desactiva. */
@ApiTags('Lista de chequeo: configuración')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({ description: 'Solo administradores' })
@RequiereRoles(Roles.ADMINISTRADOR)
@Controller('listas-chequeo')
export class ListasChequeoController {
  constructor(
    private readonly crearLista: CrearListaChequeo,
    private readonly consultarListas: ConsultarListasChequeo,
    private readonly actualizarLista: ActualizarListaChequeo,
    private readonly cambiarEstado: CambiarEstadoListaChequeo,
    private readonly preguntas: GestionarPreguntasListaChequeo,
    private readonly opciones: GestionarOpcionesListaChequeo,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Crear una lista (nace inactiva; actívela después)',
  })
  @ApiCreatedResponse({ type: ListaChequeoRespuestaDto })
  @ApiUnprocessableEntityResponse({
    description: 'Preguntas u opciones repetidas, vacías o insuficientes',
  })
  async crear(
    @Body() dto: CrearListaChequeoDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<ListaChequeoRespuestaDto> {
    return ListaChequeoRespuestaDto.desde(
      await this.crearLista.ejecutar(
        {
          nombre: dto.nombre,
          descripcion: dto.descripcion,
          items: dto.items,
          estados: dto.estados,
        },
        contexto,
      ),
    );
  }

  @Get()
  @ApiOperation({ summary: 'Consultar listas' })
  @ApiOkResponse({ type: ListasChequeoPaginadasRespuestaDto })
  async listar(
    @Query() { pagina, limite, activa, busqueda }: ConsultarListasChequeoDto,
  ): Promise<ListasChequeoPaginadasRespuestaDto> {
    return ListasChequeoPaginadasRespuestaDto.desde(
      await this.consultarListas.listar(
        { activa, busqueda },
        { pagina, limite },
      ),
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener una lista con todas sus preguntas y opciones',
  })
  @ApiOkResponse({ type: ListaChequeoRespuestaDto })
  @ApiNotFoundResponse()
  async obtener(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ListaChequeoRespuestaDto> {
    return ListaChequeoRespuestaDto.desde(
      await this.consultarListas.obtener(id),
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar nombre o descripción' })
  @ApiOkResponse({ type: ListaChequeoRespuestaDto })
  @ApiNotFoundResponse()
  async actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarListaChequeoDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<ListaChequeoRespuestaDto> {
    return ListaChequeoRespuestaDto.desde(
      await this.actualizarLista.ejecutar(
        id,
        { nombre: dto.nombre, descripcion: dto.descripcion },
        contexto,
      ),
    );
  }

  @Patch(':id/estado')
  @ApiOperation({
    summary: 'Activar (desactiva las demás) o desactivar la lista',
  })
  @ApiOkResponse({ type: ListaChequeoRespuestaDto })
  @ApiNotFoundResponse()
  async cambiarEstadoLista(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoListaChequeoDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<ListaChequeoRespuestaDto> {
    return ListaChequeoRespuestaDto.desde(
      await this.cambiarEstado.ejecutar(id, dto.activa, contexto),
    );
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Agregar una pregunta' })
  @ApiCreatedResponse({ type: ListaChequeoRespuestaDto })
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse({ description: 'Pregunta vacía o repetida' })
  async agregarPregunta(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CrearPreguntaDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<ListaChequeoRespuestaDto> {
    return ListaChequeoRespuestaDto.desde(
      await this.preguntas.agregar(id, dto, contexto),
    );
  }

  @Patch(':id/items/:itemId')
  @ApiOperation({ summary: 'Editar o desactivar una pregunta' })
  @ApiOkResponse({ type: ListaChequeoRespuestaDto })
  @ApiNotFoundResponse()
  @ApiConflictResponse({
    description:
      'La pregunta ya tiene respuestas y se intentó cambiar su texto',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Repetida, o es la última pregunta activa',
  })
  async actualizarPregunta(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: ActualizarPreguntaDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<ListaChequeoRespuestaDto> {
    return ListaChequeoRespuestaDto.desde(
      await this.preguntas.actualizar(id, itemId, dto, contexto),
    );
  }

  @Post(':id/estados')
  @ApiOperation({ summary: 'Agregar una opción de calificación' })
  @ApiCreatedResponse({ type: ListaChequeoRespuestaDto })
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse({ description: 'Opción vacía o repetida' })
  async agregarOpcion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CrearOpcionDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<ListaChequeoRespuestaDto> {
    return ListaChequeoRespuestaDto.desde(
      await this.opciones.agregar(id, dto, contexto),
    );
  }

  @Patch(':id/estados/:estadoId')
  @ApiOperation({ summary: 'Editar o desactivar una opción de calificación' })
  @ApiOkResponse({ type: ListaChequeoRespuestaDto })
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse({
    description: 'Repetida, o quedarían menos de dos opciones activas',
  })
  async actualizarOpcion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('estadoId', ParseUUIDPipe) estadoId: string,
    @Body() dto: ActualizarOpcionDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<ListaChequeoRespuestaDto> {
    return ListaChequeoRespuestaDto.desde(
      await this.opciones.actualizar(id, estadoId, dto, contexto),
    );
  }
}
