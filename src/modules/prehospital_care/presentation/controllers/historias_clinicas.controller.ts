import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
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
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../../../../common/constants/roles.js';
import { Contexto } from '../../../../common/decorators/contexto.decorator.js';
import { RequiereRoles } from '../../../../common/decorators/requiere_roles.decorator.js';
import { UsuarioActual } from '../../../../common/decorators/usuario_actual.decorator.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import type { UsuarioAutenticado } from '../../../../common/types/usuario_autenticado.js';
import { AbrirHistoriaClinica } from '../../application/use-cases/abrir_historia_clinica.use-case.js';
import { ActualizarHistoriaClinica } from '../../application/use-cases/actualizar_historia_clinica.use-case.js';
import { AnularHistoriaClinica } from '../../application/use-cases/anular_historia_clinica.use-case.js';
import { CerrarHistoriaClinica } from '../../application/use-cases/cerrar_historia_clinica.use-case.js';
import { ConsultarHistoriasClinicas } from '../../application/use-cases/consultar_historias_clinicas.use-case.js';
import { ObtenerHistoriaClinica } from '../../application/use-cases/obtener_historia_clinica.use-case.js';
import { RegistrarEnHistoria } from '../../application/use-cases/registrar_en_historia.use-case.js';
import { ObtenerFirmaCierre } from '../../application/use-cases/obtener_firma_cierre.use-case.js';
import { ExportarHistoriaPdf } from '../../application/use-cases/exportar_historia_pdf.use-case.js';
import { respuestaImagenFirma } from '../../../signatures/presentation/controllers/imagen_firma_respuesta.js';
import {
  AbrirHistoriaClinicaDto,
  ActualizarHistoriaClinicaDto,
  AnularHistoriaClinicaDto,
  CerrarHistoriaClinicaDto,
  ConsultarHistoriasClinicasDto,
  RegistrarIntervencionDto,
  RegistrarLesionDto,
  RegistrarSignoVitalDto,
} from '../dto/historia_clinica_entrada.dto.js';
import {
  CatalogosClinicosDto,
  HistoriaClinicaDetalleDto,
  HistoriaClinicaResumenDto,
  IntervencionRespuestaDto,
  LesionRespuestaDto,
  SignoVitalRespuestaDto,
} from '../dto/historia_clinica_respuesta.dto.js';

/**
 * Historia clínica prehospitalaria. La llenan el paramédico o el médico de la
 * ambulancia asignada; el administrador consulta y anula. Despachador y
 * conductor no tienen acceso a datos clínicos.
 */
@ApiTags('Historia clínica')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({
  description: 'No es el paramédico de ese servicio (o el administrador)',
})
@Controller('historias-clinicas')
export class HistoriasClinicasController {
  constructor(
    private readonly abrir: AbrirHistoriaClinica,
    private readonly actualizar: ActualizarHistoriaClinica,
    private readonly obtener: ObtenerHistoriaClinica,
    private readonly consultar: ConsultarHistoriasClinicas,
    private readonly registrar: RegistrarEnHistoria,
    private readonly cerrar: CerrarHistoriaClinica,
    private readonly anular: AnularHistoriaClinica,
    private readonly obtenerFirmaCierre: ObtenerFirmaCierre,
    private readonly exportarPdf: ExportarHistoriaPdf,
  ) {}

  // Va antes de ':id' para que "catalogos" no se tome como un id.
  @Get('catalogos')
  @RequiereRoles(Roles.PARAMEDICO, Roles.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Valores permitidos para los selects de la historia clínica',
  })
  @ApiOkResponse({ type: CatalogosClinicosDto })
  catalogos(): CatalogosClinicosDto {
    return CatalogosClinicosDto.crear();
  }

  @Post()
  @RequiereRoles(Roles.PARAMEDICO)
  @ApiOperation({
    summary:
      'Abrir la historia de un paciente del servicio (reenviar el mismo id devuelve la misma)',
  })
  @ApiCreatedResponse({ type: HistoriaClinicaDetalleDto })
  @ApiConflictResponse({ description: 'El id ya pertenece a otra historia' })
  @ApiUnprocessableEntityResponse({
    description: 'Servicio cancelado o fecha en el futuro',
  })
  async abrirHistoria(
    @Body() dto: AbrirHistoriaClinicaDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<HistoriaClinicaDetalleDto> {
    const { detalle } = await this.abrir.ejecutar(dto, contexto);
    return HistoriaClinicaDetalleDto.desde(detalle);
  }

  @Get()
  @RequiereRoles(Roles.PARAMEDICO, Roles.ADMINISTRADOR)
  @ApiOperation({ summary: 'Historias (pacientes) de un servicio' })
  @ApiOkResponse({ type: [HistoriaClinicaResumenDto] })
  async listar(
    @Query() dto: ConsultarHistoriasClinicasDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<HistoriaClinicaResumenDto[]> {
    const historias = await this.consultar.ejecutar(dto, {
      usuarioId: usuario.id,
      rol: usuario.rol,
    });
    return historias.map((h) => HistoriaClinicaResumenDto.desde(h));
  }

  @Get(':id')
  @RequiereRoles(Roles.PARAMEDICO, Roles.ADMINISTRADOR)
  @ApiOperation({
    summary:
      'Historia completa, con lo que falta para cerrarla (consulta auditada)',
  })
  @ApiOkResponse({ type: HistoriaClinicaDetalleDto })
  @ApiNotFoundResponse()
  async detalle(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<HistoriaClinicaDetalleDto> {
    return HistoriaClinicaDetalleDto.desde(
      await this.obtener.ejecutar(
        id,
        { usuarioId: usuario.id, rol: usuario.rol },
        contexto,
      ),
    );
  }

  @Patch(':id')
  @RequiereRoles(Roles.PARAMEDICO)
  @ApiOperation({
    summary:
      'Guardar lo que se va llenando (solo en borrador; null borra un dato)',
  })
  @ApiOkResponse({ type: HistoriaClinicaDetalleDto })
  @ApiNotFoundResponse()
  @ApiConflictResponse({
    description: 'Otro usuario la modificó al mismo tiempo',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Historia cerrada o anulada, institución inválida',
  })
  async guardar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarHistoriaClinicaDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<HistoriaClinicaDetalleDto> {
    return HistoriaClinicaDetalleDto.desde(
      await this.actualizar.ejecutar(id, dto, contexto),
    );
  }

  @Post(':id/signos-vitales')
  @RequiereRoles(Roles.PARAMEDICO)
  @ApiOperation({
    summary:
      'Agregar una toma de signos vitales (reenviar el mismo id no duplica)',
  })
  @ApiCreatedResponse({ type: SignoVitalRespuestaDto })
  @ApiUnprocessableEntityResponse({
    description: 'Sin mediciones, diastólica ≥ sistólica o historia cerrada',
  })
  async signoVital(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() { id: registroId, medidoEn, ...m }: RegistrarSignoVitalDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<SignoVitalRespuestaDto> {
    const signo = await this.registrar.signoVital(
      id,
      {
        id: registroId,
        medidoEn,
        mediciones: {
          presionSistolica: m.presionSistolica ?? null,
          presionDiastolica: m.presionDiastolica ?? null,
          frecuenciaCardiaca: m.frecuenciaCardiaca ?? null,
          frecuenciaRespiratoria: m.frecuenciaRespiratoria ?? null,
          saturacionOxigeno: m.saturacionOxigeno ?? null,
          temperatura: m.temperatura ?? null,
          glucometria: m.glucometria ?? null,
          glasgowOcular: m.glasgowOcular ?? null,
          glasgowVerbal: m.glasgowVerbal ?? null,
          glasgowMotor: m.glasgowMotor ?? null,
          escalaDolor: m.escalaDolor ?? null,
        },
      },
      contexto,
    );
    return SignoVitalRespuestaDto.desde(signo);
  }

  @Post(':id/lesiones')
  @RequiereRoles(Roles.PARAMEDICO)
  @ApiOperation({
    summary: 'Agregar una lesión (reenviar el mismo id no duplica)',
  })
  @ApiCreatedResponse({ type: LesionRespuestaDto })
  async lesion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegistrarLesionDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<LesionRespuestaDto> {
    return LesionRespuestaDto.desde(
      await this.registrar.lesion(id, dto, contexto),
    );
  }

  @Post(':id/intervenciones')
  @RequiereRoles(Roles.PARAMEDICO)
  @ApiOperation({
    summary:
      'Agregar un procedimiento o medicamento (reenviar el mismo id no duplica)',
  })
  @ApiCreatedResponse({ type: IntervencionRespuestaDto })
  async intervencion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegistrarIntervencionDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<IntervencionRespuestaDto> {
    return IntervencionRespuestaDto.desde(
      await this.registrar.intervencion(id, dto, contexto),
    );
  }

  @Delete(':id/signos-vitales/:registroId')
  @RequiereRoles(Roles.PARAMEDICO)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Quitar una toma de signos vitales (solo en borrador; queda auditado)',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  async quitarSignoVital(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('registroId', ParseUUIDPipe) registroId: string,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<void> {
    await this.registrar.eliminar('signo_vital', id, registroId, contexto);
  }

  @Delete(':id/lesiones/:registroId')
  @RequiereRoles(Roles.PARAMEDICO)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Quitar una lesión (solo en borrador; queda auditado)',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  async quitarLesion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('registroId', ParseUUIDPipe) registroId: string,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<void> {
    await this.registrar.eliminar('lesion', id, registroId, contexto);
  }

  @Delete(':id/intervenciones/:registroId')
  @RequiereRoles(Roles.PARAMEDICO)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Quitar una intervención (solo en borrador; queda auditado)',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  async quitarIntervencion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('registroId', ParseUUIDPipe) registroId: string,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<void> {
    await this.registrar.eliminar('intervencion', id, registroId, contexto);
  }

  @Post(':id/cerrar')
  @RequiereRoles(Roles.PARAMEDICO)
  @HttpCode(HttpStatus.OK)
  // La contraseña se puede adivinar por aquí: mismo límite que el login.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Firmar electrónicamente (con la contraseña de quien firma) y cerrar la historia; después ya no se edita',
  })
  @ApiOkResponse({ type: HistoriaClinicaDetalleDto })
  @ApiUnprocessableEntityResponse({
    description:
      'Contraseña incorrecta o falta información (el mensaje dice qué)',
  })
  async cerrarHistoria(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CerrarHistoriaClinicaDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<HistoriaClinicaDetalleDto> {
    return HistoriaClinicaDetalleDto.desde(
      await this.cerrar.ejecutar(
        id,
        {
          contrasena: dto.contrasena,
          aceptaDeclaracion: dto.aceptaDeclaracion,
        },
        contexto,
      ),
    );
  }

  @Get(':id/firma-cierre/imagen')
  @RequiereRoles(Roles.PARAMEDICO, Roles.ADMINISTRADOR)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Imagen de la firma estampada al cerrar, en PNG (la versión que se usó; consulta auditada)',
  })
  @ApiProduces('image/png')
  @ApiOkResponse({ description: 'La imagen' })
  @ApiNotFoundResponse({
    description: 'La historia no existe o se cerró sin firma registrada',
  })
  async firmaCierre(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<StreamableFile> {
    return respuestaImagenFirma(
      await this.obtenerFirmaCierre.ejecutar(
        id,
        { usuarioId: usuario.id, rol: usuario.rol },
        contexto,
      ),
    );
  }

  @Get(':id/pdf')
  @RequiereRoles(Roles.PARAMEDICO, Roles.ADMINISTRADOR)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'PDF de la historia con todas sus firmas (consulta auditada). En borrador o anulada, el PDF lo indica',
  })
  @ApiProduces('application/pdf')
  @ApiOkResponse({ description: 'El PDF' })
  @ApiNotFoundResponse({ description: 'La historia no existe' })
  async pdf(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<StreamableFile> {
    const { nombreArchivo, contenido } = await this.exportarPdf.ejecutar(
      id,
      { usuarioId: usuario.id, rol: usuario.rol },
      contexto,
    );
    return new StreamableFile(contenido, {
      type: 'application/pdf',
      disposition: `attachment; filename="${nombreArchivo}"`,
      length: contenido.byteLength,
    });
  }

  @Post(':id/anular')
  @RequiereRoles(Roles.ADMINISTRADOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Anular una historia (no se borra; el motivo queda auditado)',
  })
  @ApiOkResponse({ type: HistoriaClinicaResumenDto })
  async anularHistoria(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnularHistoriaClinicaDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<HistoriaClinicaResumenDto> {
    return HistoriaClinicaResumenDto.desde(
      await this.anular.ejecutar(id, dto.motivo, contexto),
    );
  }
}
