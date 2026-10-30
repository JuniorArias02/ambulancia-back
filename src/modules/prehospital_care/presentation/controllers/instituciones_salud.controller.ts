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
import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { ActualizarInstitucionSalud } from '../../application/use-cases/actualizar_institucion_salud.use-case.js';
import { CambiarEstadoInstitucionSalud } from '../../application/use-cases/cambiar_estado_institucion_salud.use-case.js';
import { ConsultarInstitucionesSalud } from '../../application/use-cases/consultar_instituciones_salud.use-case.js';
import { CrearInstitucionSalud } from '../../application/use-cases/crear_institucion_salud.use-case.js';
import { ObtenerInstitucionSalud } from '../../application/use-cases/obtener_institucion_salud.use-case.js';
import {
  ActualizarInstitucionSaludDto,
  CambiarEstadoInstitucionDto,
} from '../dto/actualizar_institucion_salud.dto.js';
import { ConsultarInstitucionesSaludDto } from '../dto/consultar_instituciones_salud.dto.js';
import { CrearInstitucionSaludDto } from '../dto/crear_institucion_salud.dto.js';
import {
  InstitucionesPaginadasRespuestaDto,
  InstitucionSaludRespuestaDto,
} from '../dto/institucion_salud_respuesta.dto.js';

@ApiTags('Instituciones de salud')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({ description: 'Sin permisos para la operación' })
@Controller('instituciones-salud')
export class InstitucionesSaludController {
  constructor(
    private readonly crearInstitucion: CrearInstitucionSalud,
    private readonly consultarInstituciones: ConsultarInstitucionesSalud,
    private readonly obtenerInstitucion: ObtenerInstitucionSalud,
    private readonly actualizarInstitucion: ActualizarInstitucionSalud,
    private readonly cambiarEstadoInstitucion: CambiarEstadoInstitucionSalud,
  ) {}

  @Post()
  @RequiereRoles(Roles.ADMINISTRADOR)
  @ApiOperation({ summary: 'Registrar una institución de salud (nace activa)' })
  @ApiCreatedResponse({ type: InstitucionSaludRespuestaDto })
  @ApiConflictResponse({ description: 'Código de habilitación repetido' })
  @ApiUnprocessableEntityResponse({ description: 'Coordenadas incompletas' })
  async crear(
    @Body() dto: CrearInstitucionSaludDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<InstitucionSaludRespuestaDto> {
    return InstitucionSaludRespuestaDto.desde(
      await this.crearInstitucion.ejecutar(dto, contexto),
    );
  }

  @Get()
  @RequiereRoles(
    Roles.ADMINISTRADOR,
    Roles.DESPACHADOR,
    Roles.PARAMEDICO,
    Roles.CONDUCTOR,
  )
  @ApiOperation({
    summary:
      'Consultar instituciones (por nombre, o por cercanía si envía latitud y longitud)',
  })
  @ApiOkResponse({ type: InstitucionesPaginadasRespuestaDto })
  async consultar(
    @Query()
    {
      pagina,
      limite,
      latitud,
      longitud,
      ...filtros
    }: ConsultarInstitucionesSaludDto,
  ): Promise<InstitucionesPaginadasRespuestaDto> {
    if ((latitud === undefined) !== (longitud === undefined)) {
      throw new ReglaNegocioError('Envíe la latitud y la longitud juntas');
    }
    const cercaDe =
      latitud !== undefined && longitud !== undefined
        ? { latitud, longitud }
        : undefined;
    const resultado = await this.consultarInstituciones.ejecutar(
      filtros,
      { pagina, limite },
      cercaDe,
    );
    return InstitucionesPaginadasRespuestaDto.desde(resultado, !!cercaDe);
  }

  @Get(':id')
  @RequiereRoles(
    Roles.ADMINISTRADOR,
    Roles.DESPACHADOR,
    Roles.PARAMEDICO,
    Roles.CONDUCTOR,
  )
  @ApiOperation({ summary: 'Obtener una institución de salud' })
  @ApiOkResponse({ type: InstitucionSaludRespuestaDto })
  @ApiNotFoundResponse()
  async obtener(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InstitucionSaludRespuestaDto> {
    return InstitucionSaludRespuestaDto.desde(
      await this.obtenerInstitucion.ejecutar(id),
    );
  }

  @Patch(':id')
  @RequiereRoles(Roles.ADMINISTRADOR)
  @ApiOperation({ summary: 'Editar una institución de salud' })
  @ApiOkResponse({ type: InstitucionSaludRespuestaDto })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Código de habilitación repetido' })
  async actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarInstitucionSaludDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<InstitucionSaludRespuestaDto> {
    return InstitucionSaludRespuestaDto.desde(
      await this.actualizarInstitucion.ejecutar(id, dto, contexto),
    );
  }

  @Patch(':id/estado')
  @RequiereRoles(Roles.ADMINISTRADOR)
  @ApiOperation({ summary: 'Activar o inactivar una institución' })
  @ApiOkResponse({ type: InstitucionSaludRespuestaDto })
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse({ description: 'Ya estaba en ese estado' })
  async cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoInstitucionDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<InstitucionSaludRespuestaDto> {
    return InstitucionSaludRespuestaDto.desde(
      await this.cambiarEstadoInstitucion.ejecutar(id, dto.activa, contexto),
    );
  }
}
