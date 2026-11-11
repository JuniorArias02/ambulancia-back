import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../../../../common/constants/roles.js';
import { Contexto } from '../../../../common/decorators/contexto.decorator.js';
import { RequiereRoles } from '../../../../common/decorators/requiere_roles.decorator.js';
import { NoAutenticadoError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { ConsultarChequeosDiarios } from '../../application/use-cases/consultar_chequeos_diarios.use-case.js';
import { FinalizarChequeoDiario } from '../../application/use-cases/finalizar_chequeo_diario.use-case.js';
import { IniciarChequeoDiario } from '../../application/use-cases/iniciar_chequeo_diario.use-case.js';
import { ObtenerMiChequeoDelDia } from '../../application/use-cases/obtener_mi_chequeo_del_dia.use-case.js';
import { ResponderChequeoDiario } from '../../application/use-cases/responder_chequeo_diario.use-case.js';
import {
  ChequeoDelDiaRespuestaDto,
  ChequeoDiarioRespuestaDto,
  ChequeoIniciadoRespuestaDto,
  ChequeosDiariosPaginadosRespuestaDto,
} from '../dto/chequeo_diario_respuesta.dto.js';
import { HistorialChequeosDto } from '../dto/consultar_chequeos_diarios.dto.js';
import { ResponderChequeoDto } from '../dto/responder_chequeo.dto.js';

/**
 * El conductor diligencia la lista de la ambulancia que eligió en la app. El
 * conductor y la ambulancia salen del token y del turno, nunca del cuerpo.
 */
@ApiTags('Lista de chequeo: conductor')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({ description: 'Solo el conductor de la ambulancia' })
@RequiereRoles(Roles.CONDUCTOR)
@Controller('mi-chequeo-diario')
export class MiChequeoDiarioController {
  constructor(
    private readonly obtenerDelDia: ObtenerMiChequeoDelDia,
    private readonly iniciarChequeo: IniciarChequeoDiario,
    private readonly responderChequeo: ResponderChequeoDiario,
    private readonly finalizarChequeo: FinalizarChequeoDiario,
    private readonly consultarChequeos: ConsultarChequeosDiarios,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'La lista activa y el chequeo de hoy (si ya empezó)',
  })
  @ApiOkResponse({ type: ChequeoDelDiaRespuestaDto })
  @ApiNotFoundResponse({ description: 'No hay una lista de chequeo activa' })
  @ApiUnprocessableEntityResponse({
    description: 'No ha seleccionado ambulancia',
  })
  async delDia(
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<ChequeoDelDiaRespuestaDto> {
    return ChequeoDelDiaRespuestaDto.desde(
      await this.obtenerDelDia.ejecutar(contexto),
    );
  }

  @Post()
  @ApiOperation({
    summary: 'Iniciar el chequeo de hoy (201 si lo crea, 200 si ya existía)',
  })
  @ApiCreatedResponse({ type: ChequeoIniciadoRespuestaDto })
  @ApiOkResponse({ type: ChequeoIniciadoRespuestaDto })
  @ApiNotFoundResponse({ description: 'No hay una lista de chequeo activa' })
  @ApiUnprocessableEntityResponse({
    description: 'No ha seleccionado ambulancia',
  })
  async iniciar(
    @Contexto() contexto: ContextoSolicitud,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<ChequeoIniciadoRespuestaDto> {
    const iniciado = await this.iniciarChequeo.ejecutar(contexto);
    respuesta.status(iniciado.creado ? HttpStatus.CREATED : HttpStatus.OK);
    return ChequeoIniciadoRespuestaDto.desdeIniciado(iniciado);
  }

  @Put('respuestas')
  @ApiOperation({
    summary:
      'Guardar respuestas del borrador (una pregunta respondida otra vez se reemplaza)',
  })
  @ApiOkResponse({ type: ChequeoDiarioRespuestaDto })
  @ApiNotFoundResponse({ description: 'No ha iniciado el chequeo de hoy' })
  @ApiConflictResponse({ description: 'Se finalizó mientras tanto' })
  @ApiUnprocessableEntityResponse({
    description:
      'Ya finalizado, pregunta u opción de otra lista, u observación faltante o no permitida',
  })
  async responder(
    @Body() dto: ResponderChequeoDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<ChequeoDiarioRespuestaDto> {
    return ChequeoDiarioRespuestaDto.desdeConLista(
      await this.responderChequeo.ejecutar(dto.respuestas, contexto),
    );
  }

  @Post('finalizar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Finalizar el chequeo de hoy (ya no se edita)' })
  @ApiOkResponse({ type: ChequeoDiarioRespuestaDto })
  @ApiNotFoundResponse({ description: 'No ha iniciado el chequeo de hoy' })
  @ApiConflictResponse({ description: 'Se finalizó mientras tanto' })
  @ApiUnprocessableEntityResponse({
    description: 'Faltan preguntas obligatorias o ya estaba finalizado',
  })
  async finalizar(
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<ChequeoDiarioRespuestaDto> {
    return ChequeoDiarioRespuestaDto.desdeConLista(
      await this.finalizarChequeo.ejecutar(contexto),
    );
  }

  @Get('historial')
  @ApiOperation({ summary: 'Mis chequeos, del más reciente al más antiguo' })
  @ApiOkResponse({ type: ChequeosDiariosPaginadosRespuestaDto })
  async historial(
    @Query() { pagina, limite, estado, desde, hasta }: HistorialChequeosDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<ChequeosDiariosPaginadosRespuestaDto> {
    return ChequeosDiariosPaginadosRespuestaDto.desde(
      await this.consultarChequeos.listar(
        { estado, desde, hasta },
        { pagina, limite },
        this.conductor(contexto),
      ),
    );
  }

  @Get('historial/:id')
  @ApiOperation({ summary: 'Detalle de uno de mis chequeos' })
  @ApiOkResponse({ type: ChequeoDiarioRespuestaDto })
  @ApiNotFoundResponse({ description: 'No existe o no es suyo' })
  async detalle(
    @Param('id', ParseUUIDPipe) id: string,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<ChequeoDiarioRespuestaDto> {
    return ChequeoDiarioRespuestaDto.desdeConLista(
      await this.consultarChequeos.obtener(id, this.conductor(contexto)),
    );
  }

  private conductor(contexto: ContextoSolicitud): string {
    if (!contexto.usuarioId) throw new NoAutenticadoError();
    return contexto.usuarioId;
  }
}
