import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Roles } from '../../../../common/constants/roles.js';
import { Contexto } from '../../../../common/decorators/contexto.decorator.js';
import { RequiereRoles } from '../../../../common/decorators/requiere_roles.decorator.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { BuscarHistoriasClinicas } from '../../application/use-cases/buscar_historias_clinicas.use-case.js';
import { ConsultarTrazabilidadHistoria } from '../../application/use-cases/consultar_trazabilidad_historia.use-case.js';
import { ObtenerIngreso } from '../../application/use-cases/obtener_ingreso.use-case.js';
import { BuscarPacientes } from '../../application/use-cases/buscar_pacientes.use-case.js';
import { ConsultarIndicadoresClinicos } from '../../application/use-cases/consultar_indicadores_clinicos.use-case.js';
import { ExportarHistoriasCsv } from '../../application/use-cases/exportar_historias_csv.use-case.js';
import { ObtenerFichaPaciente } from '../../application/use-cases/obtener_ficha_paciente.use-case.js';
import {
  BuscarHistoriasClinicasDto,
  BuscarPacientesDto,
  ConsultarIndicadoresDto,
  ConsultarTrazabilidadDto,
  ExportarHistoriasDto,
} from '../dto/consulta_clinica_entrada.dto.js';
import {
  FichaPacienteDto,
  IndicadoresClinicosDto,
  IngresoServicioDto,
  PaginaHistoriasConsultaDto,
  PaginaPacientesDto,
  PaginaTrazabilidadDto,
} from '../dto/consulta_clinica_respuesta.dto.js';

/**
 * Consulta clínica web (solo lectura, administrador): bandeja de historias,
 * ingreso o servicio completo y trazabilidad. El expediente de cada historia
 * sale por GET /historias-clinicas/{id}. Cada consulta queda auditada.
 */
@ApiTags('Consulta clínica')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({ description: 'Solo el administrador' })
@RequiereRoles(Roles.ADMINISTRADOR)
@Controller('consulta-clinica')
export class ConsultaClinicaController {
  constructor(
    private readonly buscar: BuscarHistoriasClinicas,
    private readonly obtenerIngreso: ObtenerIngreso,
    private readonly trazabilidad: ConsultarTrazabilidadHistoria,
    private readonly exportarCsv: ExportarHistoriasCsv,
    private readonly buscarPacientes: BuscarPacientes,
    private readonly obtenerFicha: ObtenerFichaPaciente,
    private readonly indicadores: ConsultarIndicadoresClinicos,
  ) {}

  @Get('historias/exportar')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Exportar a CSV (Excel) con los mismos filtros de la bandeja; máximo 5000 filas (auditado)',
  })
  @ApiProduces('text/csv')
  @ApiOkResponse({ description: 'CSV con separador ";" y UTF-8 con BOM' })
  @ApiUnprocessableEntityResponse({
    description: 'Más de 5000 historias o fechas inválidas',
  })
  async exportar(
    @Query() dto: ExportarHistoriasDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<StreamableFile> {
    const { nombreArchivo, contenido } = await this.exportarCsv.ejecutar(
      dto,
      contexto,
    );
    return new StreamableFile(Buffer.from(contenido, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${nombreArchivo}"`,
    });
  }

  @Get('pacientes')
  @ApiOperation({
    summary:
      'Índice de pacientes por documento o nombre (auditado sin los valores)',
  })
  @ApiOkResponse({ type: PaginaPacientesDto })
  async pacientes(
    @Query() dto: BuscarPacientesDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<PaginaPacientesDto> {
    return PaginaPacientesDto.desde(
      await this.buscarPacientes.ejecutar(dto, contexto),
    );
  }

  @Get('pacientes/:id')
  @ApiOperation({
    summary:
      'Ficha del paciente: sus atenciones, alergias y antecedentes reunidos y el último riesgo de caída (auditada)',
  })
  @ApiOkResponse({ type: FichaPacienteDto })
  @ApiNotFoundResponse({ description: 'El paciente no existe' })
  async fichaPaciente(
    @Param('id', ParseUUIDPipe) id: string,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<FichaPacienteDto> {
    return FichaPacienteDto.desde(
      await this.obtenerFicha.ejecutar(id, contexto),
    );
  }

  @Get('indicadores')
  @ApiOperation({
    summary:
      'Tablero: conteos por estado, triage, desenlace, modalidad y tipo de evento, historias por día, destinos y tiempos de respuesta',
  })
  @ApiOkResponse({ type: IndicadoresClinicosDto })
  @ApiUnprocessableEntityResponse({
    description: 'Rango inválido o de más de 366 días',
  })
  async consultarIndicadores(
    @Query() dto: ConsultarIndicadoresDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<IndicadoresClinicosDto> {
    return IndicadoresClinicosDto.desde(
      await this.indicadores.ejecutar(dto, contexto),
    );
  }

  @Get('historias')
  @ApiOperation({
    summary:
      'Buscar historias por fecha, ingreso, número, paciente y datos clínicos (paginado; búsqueda auditada sin los valores buscados)',
  })
  @ApiOkResponse({ type: PaginaHistoriasConsultaDto })
  @ApiUnprocessableEntityResponse({
    description: 'Fecha inexistente, desde > hasta o rango de más de 366 días',
  })
  async buscarHistorias(
    @Query() dto: BuscarHistoriasClinicasDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<PaginaHistoriasConsultaDto> {
    return PaginaHistoriasConsultaDto.desde(
      await this.buscar.ejecutar(dto, contexto),
    );
  }

  @Get('ingresos/:numeroOId')
  @ApiOperation({
    summary:
      'Ingreso o servicio completo: solicitud, ambulancias, tripulación, línea de tiempo, tiempos, recorrido, insumos e historias (auditado)',
    description:
      'Acepta el número del ingreso (EMG-…) o el id de la emergencia',
  })
  @ApiOkResponse({ type: IngresoServicioDto })
  @ApiNotFoundResponse({ description: 'El ingreso no existe' })
  async ingreso(
    @Param('numeroOId') numeroOId: string,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<IngresoServicioDto> {
    return IngresoServicioDto.desde(
      await this.obtenerIngreso.ejecutar(numeroOId, contexto),
    );
  }

  @Get('historias/:id/trazabilidad')
  @ApiOperation({
    summary:
      'Quién abrió, modificó, firmó, anuló o consultó la historia, y cuándo (sin valores clínicos; auditado)',
  })
  @ApiOkResponse({ type: PaginaTrazabilidadDto })
  @ApiNotFoundResponse({ description: 'La historia no existe' })
  async trazabilidadHistoria(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: ConsultarTrazabilidadDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<PaginaTrazabilidadDto> {
    return PaginaTrazabilidadDto.desde(
      await this.trazabilidad.ejecutar(id, dto, contexto),
    );
  }
}
