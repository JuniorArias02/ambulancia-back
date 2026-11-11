import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../../../common/constants/roles.js';
import { RequiereRoles } from '../../../../common/decorators/requiere_roles.decorator.js';
import { ConsultarChequeosDiarios } from '../../application/use-cases/consultar_chequeos_diarios.use-case.js';
import {
  ChequeoDiarioRespuestaDto,
  ChequeosDiariosPaginadosRespuestaDto,
} from '../dto/chequeo_diario_respuesta.dto.js';
import { ConsultarChequeosDiariosDto } from '../dto/consultar_chequeos_diarios.dto.js';

/** Historial para la central. */
@ApiTags('Lista de chequeo: historial')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({ description: 'Solo administrador y despachador' })
@RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR)
@Controller('chequeos-diarios')
export class ChequeosDiariosController {
  constructor(private readonly consultarChequeos: ConsultarChequeosDiarios) {}

  @Get()
  @ApiOperation({ summary: 'Chequeos diarios con filtros, del más reciente' })
  @ApiOkResponse({ type: ChequeosDiariosPaginadosRespuestaDto })
  async listar(
    @Query()
    {
      pagina,
      limite,
      conductorId,
      ambulanciaId,
      estado,
      desde,
      hasta,
    }: ConsultarChequeosDiariosDto,
  ): Promise<ChequeosDiariosPaginadosRespuestaDto> {
    return ChequeosDiariosPaginadosRespuestaDto.desde(
      await this.consultarChequeos.listar(
        { conductorId, ambulanciaId, estado, desde, hasta },
        { pagina, limite },
      ),
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalle con el texto de cada pregunta y la calificación elegida',
  })
  @ApiOkResponse({ type: ChequeoDiarioRespuestaDto })
  @ApiNotFoundResponse()
  async obtener(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ChequeoDiarioRespuestaDto> {
    return ChequeoDiarioRespuestaDto.desdeConLista(
      await this.consultarChequeos.obtener(id),
    );
  }
}
