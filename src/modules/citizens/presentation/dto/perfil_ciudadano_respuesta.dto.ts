import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TIPOS_DOCUMENTO_CIUDADANO,
  type Ciudadano,
  type TipoDocumentoCiudadano,
} from '../../domain/entities/ciudadano.entity.js';
import {
  ESTADOS_VERIFICACION,
  type EstadoVerificacion,
  LADOS_DOCUMENTO,
  type LadoDocumento,
} from '../../domain/entities/verificacion_identidad.entity.js';

export class DocumentoCargadoRespuestaDto {
  @ApiProperty({ enum: LADOS_DOCUMENTO })
  lado: LadoDocumento;

  @ApiProperty()
  cargadoEn: Date;
}

export class EstadoVerificacionRespuestaDto {
  @ApiProperty({ enum: ESTADOS_VERIFICACION })
  estado: EstadoVerificacion;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Motivo del rechazo o de la corrección pedida',
  })
  motivo: string | null;

  @ApiProperty({ description: 'Solo true en estado verificado' })
  puedeReportarEmergencias: boolean;

  @ApiProperty({ description: 'Solo true en estado requiere_correccion' })
  puedeReenviar: boolean;

  @ApiProperty({ description: 'Último envío a revisión' })
  enviadaEn: Date;

  @ApiPropertyOptional({ type: Date, nullable: true })
  revisadaEn: Date | null;

  @ApiProperty({ type: [DocumentoCargadoRespuestaDto] })
  documentos: DocumentoCargadoRespuestaDto[];

  static desde(ciudadano: Ciudadano): EstadoVerificacionRespuestaDto {
    const { verificacion } = ciudadano;
    return {
      estado: verificacion.estado,
      motivo: verificacion.motivo,
      puedeReportarEmergencias: verificacion.permiteReportar(),
      puedeReenviar: verificacion.permiteReenviar(),
      enviadaEn: verificacion.enviadaEn,
      revisadaEn: verificacion.revisadaEn,
      documentos: verificacion.documentos.map((d) => ({
        lado: d.lado,
        cargadoEn: d.cargadoEn,
      })),
    };
  }
}

export class PerfilCiudadanoRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'ciudadano' })
  rol: 'ciudadano';

  @ApiProperty()
  nombres: string;

  @ApiProperty()
  apellidos: string;

  @ApiProperty({ enum: TIPOS_DOCUMENTO_CIUDADANO })
  tipoDocumento: TipoDocumentoCiudadano;

  @ApiProperty({
    example: '••••••3456',
    description: 'Solo los últimos 4 dígitos',
  })
  numeroDocumento: string;

  @ApiProperty({ example: '1990-05-17', description: 'AAAA-MM-DD' })
  fechaNacimiento: string;

  @ApiProperty()
  correo: string;

  @ApiProperty()
  telefono: string;

  @ApiProperty()
  creadoEn: Date;

  @ApiProperty({ type: EstadoVerificacionRespuestaDto })
  verificacion: EstadoVerificacionRespuestaDto;

  static desde(ciudadano: Ciudadano): PerfilCiudadanoRespuestaDto {
    return {
      id: ciudadano.id,
      rol: 'ciudadano',
      nombres: ciudadano.nombres,
      apellidos: ciudadano.apellidos,
      tipoDocumento: ciudadano.tipoDocumento,
      numeroDocumento: ciudadano.documentoEnmascarado(),
      fechaNacimiento: ciudadano.fechaNacimiento,
      correo: ciudadano.correo,
      telefono: ciudadano.telefono,
      creadoEn: ciudadano.creadoEn,
      verificacion: EstadoVerificacionRespuestaDto.desde(ciudadano),
    };
  }
}
