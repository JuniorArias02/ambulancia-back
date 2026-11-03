import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
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
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { ConsultarAmbulanciasSeleccionables } from '../../application/use-cases/consultar_ambulancias_seleccionables.use-case.js';
import { SalirDeAmbulancia } from '../../application/use-cases/salir_de_ambulancia.use-case.js';
import { SeleccionarAmbulancia } from '../../application/use-cases/seleccionar_ambulancia.use-case.js';
import { AmbulanciaSeleccionableRespuestaDto } from '../dto/ambulancia_seleccionable_respuesta.dto.js';
import { SeleccionarAmbulanciaDto } from '../dto/seleccionar_ambulancia.dto.js';
import { TurnoRespuestaDto } from '../dto/turno_respuesta.dto.js';

/** El usuario y su función salen del token; el cliente solo dice qué ambulancia. */
@ApiTags('Mi ambulancia')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({ description: 'Solo conductor o paramédico' })
@RequiereRoles(Roles.CONDUCTOR, Roles.PARAMEDICO)
@Controller('mi-ambulancia')
export class MiAmbulanciaController {
  constructor(
    private readonly consultarSeleccionables: ConsultarAmbulanciasSeleccionables,
    private readonly seleccionarAmbulancia: SeleccionarAmbulancia,
    private readonly salirDeAmbulancia: SalirDeAmbulancia,
  ) {}

  @Get('opciones')
  @ApiOperation({ summary: 'Ambulancias y si el usuario puede seleccionarlas' })
  @ApiOkResponse({ type: [AmbulanciaSeleccionableRespuestaDto] })
  async opciones(
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<AmbulanciaSeleccionableRespuestaDto[]> {
    const opciones = await this.consultarSeleccionables.ejecutar(contexto);
    return opciones.map((opcion) =>
      AmbulanciaSeleccionableRespuestaDto.desde(opcion),
    );
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Seleccionar la ambulancia en la que trabaja el usuario',
  })
  @ApiOkResponse({ type: TurnoRespuestaDto })
  @ApiNotFoundResponse({ description: 'La ambulancia no existe' })
  @ApiConflictResponse({
    description:
      'Ya está en otra ambulancia, la ambulancia está en servicio o no hay cupo',
  })
  @ApiUnprocessableEntityResponse({
    description: 'La ambulancia está en mantenimiento',
  })
  async seleccionar(
    @Body() dto: SeleccionarAmbulanciaDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<TurnoRespuestaDto> {
    return TurnoRespuestaDto.desde(
      await this.seleccionarAmbulancia.ejecutar(dto.ambulanciaId, contexto),
    );
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Salir de la ambulancia actual' })
  @ApiNoContentResponse()
  @ApiUnprocessableEntityResponse({
    description: 'La ambulancia está atendiendo un servicio',
  })
  async salir(@Contexto() contexto: ContextoSolicitud): Promise<void> {
    await this.salirDeAmbulancia.ejecutar(contexto);
  }
}
