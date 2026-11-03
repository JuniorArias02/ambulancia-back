import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
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
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Roles } from '../../../../common/constants/roles.js';
import { Contexto } from '../../../../common/decorators/contexto.decorator.js';
import { RequiereRoles } from '../../../../common/decorators/requiere_roles.decorator.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { ConsultarMisEmergencias } from '../../application/use-cases/consultar_mis_emergencias.use-case.js';
import { ObtenerCiudadano } from '../../application/use-cases/obtener_ciudadano.use-case.js';
import { ReportarEmergenciaCiudadana } from '../../application/use-cases/reportar_emergencia_ciudadana.use-case.js';
import { ConsultarMisEmergenciasDto } from '../dto/consultar_mis_emergencias.dto.js';
import {
  ReporteCiudadanoRespuestaDto,
  ReporteRegistradoRespuestaDto,
  ReportesPaginadosRespuestaDto,
} from '../dto/reporte_ciudadano_respuesta.dto.js';
import { ReportarEmergenciaDto } from '../dto/reportar_emergencia.dto.js';

/** No existe ninguna ruta para cambiar prioridad, estado o ambulancia: eso es de la central. */
@ApiTags('Ciudadanos')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({ description: 'No es un ciudadano' })
@RequiereRoles(Roles.CIUDADANO)
@Controller('ciudadanos/emergencias')
export class EmergenciasCiudadanasController {
  constructor(
    private readonly reportarEmergencia: ReportarEmergenciaCiudadana,
    private readonly consultarMisEmergencias: ConsultarMisEmergencias,
    private readonly obtenerCiudadano: ObtenerCiudadano,
  ) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Reportar una emergencia (solo con la identidad verificada)',
    description:
      'Queda recibida, sin prioridad ni ambulancia: la central la revisa y despacha. 201 si es nueva, 200 si es un reintento con el mismo id.',
  })
  @ApiCreatedResponse({ type: ReporteRegistradoRespuestaDto })
  @ApiOkResponse({
    type: ReporteRegistradoRespuestaDto,
    description: 'Reintento: el reporte ya existía',
  })
  @ApiForbiddenResponse({
    description: 'Identidad sin verificar, o el usuario no es ciudadano',
  })
  @ApiConflictResponse({ description: 'El id ya lo usa otro reporte' })
  @ApiTooManyRequestsResponse({ description: 'Más de 5 reportes por minuto' })
  async reportar(
    @Body() dto: ReportarEmergenciaDto,
    @Contexto() contexto: ContextoSolicitud,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<ReporteRegistradoRespuestaDto> {
    const { emergencia, creado } = await this.reportarEmergencia.ejecutar(
      dto,
      contexto,
    );
    respuesta.status(creado ? HttpStatus.CREATED : HttpStatus.OK);
    return ReporteRegistradoRespuestaDto.desdeRegistro(emergencia, creado);
  }

  @Get()
  @ApiOperation({ summary: 'Mis reportes, del más reciente al más antiguo' })
  @ApiOkResponse({ type: ReportesPaginadosRespuestaDto })
  async listar(
    @Query() { pagina, limite, ...filtros }: ConsultarMisEmergenciasDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<ReportesPaginadosRespuestaDto> {
    const { id } = await this.obtenerCiudadano.ejecutar(contexto.usuarioId);
    return ReportesPaginadosRespuestaDto.desde(
      await this.consultarMisEmergencias.listar(id, filtros, {
        pagina,
        limite,
      }),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle y estado de uno de mis reportes' })
  @ApiOkResponse({ type: ReporteCiudadanoRespuestaDto })
  @ApiNotFoundResponse({ description: 'No existe o no es suyo' })
  async obtener(
    @Param('id', ParseUUIDPipe) emergenciaId: string,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<ReporteCiudadanoRespuestaDto> {
    const { id } = await this.obtenerCiudadano.ejecutar(contexto.usuarioId);
    return ReporteCiudadanoRespuestaDto.desde(
      await this.consultarMisEmergencias.obtener(id, emergenciaId),
    );
  }
}
