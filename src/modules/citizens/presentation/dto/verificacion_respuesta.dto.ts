import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import type { DetalleVerificacion } from '../../application/use-cases/obtener_verificacion.use-case.js';
import {
  TIPOS_DOCUMENTO_CIUDADANO,
  type Ciudadano,
  type EstadoCuenta,
  type TipoDocumentoCiudadano,
} from '../../domain/entities/ciudadano.entity.js';
import {
  ESTADOS_VERIFICACION,
  type EstadoVerificacion,
  LADOS_DOCUMENTO,
  type LadoDocumento,
} from '../../domain/entities/verificacion_identidad.entity.js';

/** Solo para el administrador: el documento va completo. */
export class VerificacionResumenRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  usuarioId: string;

  @ApiProperty()
  nombres: string;

  @ApiProperty()
  apellidos: string;

  @ApiProperty({ enum: TIPOS_DOCUMENTO_CIUDADANO })
  tipoDocumento: TipoDocumentoCiudadano;

  @ApiProperty()
  numeroDocumento: string;

  @ApiProperty()
  correo: string;

  @ApiProperty()
  telefono: string;

  @ApiProperty({ enum: ESTADOS_VERIFICACION })
  estado: EstadoVerificacion;

  @ApiProperty()
  enviadaEn: Date;

  @ApiPropertyOptional({ type: Date, nullable: true })
  revisadaEn: Date | null;

  static desde(ciudadano: Ciudadano): VerificacionResumenRespuestaDto {
    return camposResumen(ciudadano);
  }
}

function camposResumen(ciudadano: Ciudadano) {
  return {
    usuarioId: ciudadano.id,
    nombres: ciudadano.nombres,
    apellidos: ciudadano.apellidos,
    tipoDocumento: ciudadano.tipoDocumento,
    numeroDocumento: ciudadano.numeroDocumento,
    correo: ciudadano.correo,
    telefono: ciudadano.telefono,
    estado: ciudadano.verificacion.estado,
    enviadaEn: ciudadano.verificacion.enviadaEn,
    revisadaEn: ciudadano.verificacion.revisadaEn,
  };
}

export class VerificacionesPaginadasRespuestaDto {
  @ApiProperty({ type: [VerificacionResumenRespuestaDto] })
  datos: VerificacionResumenRespuestaDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  pagina: number;

  @ApiProperty()
  limite: number;

  static desde(
    resultado: ResultadoPaginado<Ciudadano>,
  ): VerificacionesPaginadasRespuestaDto {
    return {
      ...resultado,
      datos: resultado.datos.map((c) =>
        VerificacionResumenRespuestaDto.desde(c),
      ),
    };
  }
}

export class DocumentoIdentidadRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: LADOS_DOCUMENTO })
  lado: LadoDocumento;

  @ApiProperty({ example: 'image/jpeg' })
  tipoMime: string;

  @ApiProperty()
  tamanoBytes: number;

  @ApiProperty()
  cargadoEn: Date;
}

export class ResponsableRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  nombreCompleto: string | null;
}

export class HistorialVerificacionRespuestaDto {
  @ApiPropertyOptional({ enum: ESTADOS_VERIFICACION, nullable: true })
  estadoAnterior: EstadoVerificacion | null;

  @ApiProperty({ enum: ESTADOS_VERIFICACION })
  estadoNuevo: EstadoVerificacion;

  @ApiPropertyOptional({ type: String, nullable: true })
  motivo: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  observaciones: string | null;

  @ApiProperty({ type: ResponsableRespuestaDto })
  responsable: ResponsableRespuestaDto;

  @ApiProperty()
  ocurridoEn: Date;
}

export class VerificacionDetalleRespuestaDto extends VerificacionResumenRespuestaDto {
  @ApiProperty({ example: '1990-05-17' })
  fechaNacimiento: string;

  @ApiProperty({ enum: ['activo', 'inactivo', 'bloqueado'] })
  estadoCuenta: EstadoCuenta;

  @ApiProperty()
  registradoEn: Date;

  @ApiPropertyOptional({ type: String, nullable: true })
  motivo: string | null;

  @ApiPropertyOptional({ type: ResponsableRespuestaDto, nullable: true })
  revisadaPor: ResponsableRespuestaDto | null;

  @ApiProperty({
    type: [DocumentoIdentidadRespuestaDto],
    description:
      'Fotos vigentes; se descargan con GET /verificaciones-ciudadanos/{usuarioId}/documentos/{id}',
  })
  documentos: DocumentoIdentidadRespuestaDto[];

  @ApiProperty({ type: [HistorialVerificacionRespuestaDto] })
  historial: HistorialVerificacionRespuestaDto[];

  static desdeDetalle({
    ciudadano,
    historial,
  }: DetalleVerificacion): VerificacionDetalleRespuestaDto {
    const { verificacion } = ciudadano;
    const revisor = historial.findLast(
      (h) => h.responsableId === verificacion.revisadaPorId,
    );
    return {
      ...camposResumen(ciudadano),
      fechaNacimiento: ciudadano.fechaNacimiento,
      estadoCuenta: ciudadano.estadoCuenta,
      registradoEn: ciudadano.creadoEn,
      motivo: verificacion.motivo,
      revisadaPor: verificacion.revisadaPorId
        ? {
            id: verificacion.revisadaPorId,
            nombreCompleto: revisor?.responsableNombre ?? null,
          }
        : null,
      documentos: verificacion.documentos.map((d) => ({
        id: d.id,
        lado: d.lado,
        tipoMime: d.tipoMime,
        tamanoBytes: d.tamanoBytes,
        cargadoEn: d.cargadoEn,
      })),
      historial: historial.map((h) => ({
        estadoAnterior: h.estadoAnterior,
        estadoNuevo: h.estadoNuevo,
        motivo: h.motivo,
        observaciones: h.observaciones,
        responsable: {
          id: h.responsableId,
          nombreCompleto: h.responsableNombre,
        },
        ocurridoEn: h.ocurridoEn,
      })),
    };
  }
}
