import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
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
import { UsuarioActual } from '../../../../common/decorators/usuario_actual.decorator.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import type { UsuarioAutenticado } from '../../../../common/types/usuario_autenticado.js';
import { ConsultarValoracionesDownton } from '../../application/use-cases/consultar_valoraciones_downton.use-case.js';
import { ObtenerValoracionDownton } from '../../application/use-cases/obtener_valoracion_downton.use-case.js';
import { RegistrarEnHistoria } from '../../application/use-cases/registrar_en_historia.use-case.js';
import { RegistrarValoracionDownton } from '../../application/use-cases/registrar_valoracion_downton.use-case.js';
import {
  RegistrarValoracionDowntonDto,
  ValoracionDowntonRespuestaDto,
} from '../dto/valoracion_downton.dto.js';

/**
 * Escala de riesgo de caídas J.H. Downton dentro de la historia clínica.
 * Es opcional; la registra el paramédico o el médico del servicio y la
 * consulta además el administrador.
 */
@ApiTags('Historia clínica')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({
  description: 'No es el paramédico de ese servicio (o el administrador)',
})
@Controller('historias-clinicas/:id/valoraciones-downton')
export class ValoracionesDowntonController {
  constructor(
    private readonly registrar: RegistrarValoracionDownton,
    private readonly consultar: ConsultarValoracionesDownton,
    private readonly obtener: ObtenerValoracionDownton,
    private readonly registrosHistoria: RegistrarEnHistoria,
  ) {}

  @Post()
  @RequiereRoles(Roles.PARAMEDICO)
  @ApiOperation({
    summary:
      'Registrar una valoración de riesgo de caídas (puntaje y nivel calculados; reenviar el mismo id no duplica)',
  })
  @ApiCreatedResponse({ type: ValoracionDowntonRespuestaDto })
  @ApiNotFoundResponse({ description: 'La historia no existe' })
  @ApiConflictResponse({ description: 'El id ya pertenece a otra historia' })
  @ApiUnprocessableEntityResponse({
    description:
      'Historia cerrada o anulada, fecha en el futuro o segmento de audio inválido',
  })
  async registrarValoracion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegistrarValoracionDowntonDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<ValoracionDowntonRespuestaDto> {
    const valoracion = await this.registrar.ejecutar(
      id,
      {
        id: dto.id,
        evaluadaEn: dto.evaluadaEn,
        respuestas: {
          caidasPrevias: dto.caidasPrevias,
          medTranquilizantesSedantes: dto.medTranquilizantesSedantes,
          medDiureticos: dto.medDiureticos,
          medHipotensores: dto.medHipotensores,
          medAntiparkinsonianos: dto.medAntiparkinsonianos,
          medAntidepresivos: dto.medAntidepresivos,
          medOtros: dto.medOtros,
          deficitVisual: dto.deficitVisual,
          deficitAuditivo: dto.deficitAuditivo,
          deficitExtremidades: dto.deficitExtremidades,
          estadoMental: dto.estadoMental,
          deambulacion: dto.deambulacion,
        },
        observacion: dto.observacion,
        origen: dto.origen,
        segmentoAudioId: dto.segmentoAudioId,
      },
      contexto,
    );
    return ValoracionDowntonRespuestaDto.desde(valoracion);
  }

  @Get()
  @RequiereRoles(Roles.PARAMEDICO, Roles.ADMINISTRADOR)
  @ApiOperation({
    summary:
      'Valoraciones de caídas de la historia, de la más antigua a la más reciente (consulta auditada)',
  })
  @ApiOkResponse({ type: [ValoracionDowntonRespuestaDto] })
  @ApiNotFoundResponse({ description: 'La historia no existe' })
  async listarValoraciones(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<ValoracionDowntonRespuestaDto[]> {
    const valoraciones = await this.consultar.ejecutar(
      id,
      { usuarioId: usuario.id, rol: usuario.rol },
      contexto,
    );
    return valoraciones.map((v) => ValoracionDowntonRespuestaDto.desde(v));
  }

  @Get(':valoracionId')
  @RequiereRoles(Roles.PARAMEDICO, Roles.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Detalle de una valoración de caídas (consulta auditada)',
  })
  @ApiOkResponse({ type: ValoracionDowntonRespuestaDto })
  @ApiNotFoundResponse({
    description: 'La historia o la valoración no existen',
  })
  async detalleValoracion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('valoracionId', ParseUUIDPipe) valoracionId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<ValoracionDowntonRespuestaDto> {
    return ValoracionDowntonRespuestaDto.desde(
      await this.obtener.ejecutar(
        id,
        valoracionId,
        { usuarioId: usuario.id, rol: usuario.rol },
        contexto,
      ),
    );
  }

  @Delete(':valoracionId')
  @RequiereRoles(Roles.PARAMEDICO)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Quitar una valoración de caídas (solo en borrador; queda auditado)',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  async quitarValoracion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('valoracionId', ParseUUIDPipe) valoracionId: string,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<void> {
    await this.registrosHistoria.eliminar(
      'valoracion_downton',
      id,
      valoracionId,
      contexto,
    );
  }
}
