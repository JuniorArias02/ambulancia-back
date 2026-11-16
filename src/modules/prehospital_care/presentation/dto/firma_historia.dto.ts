import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { TIPOS_DOCUMENTO } from '../../domain/catalogos_clinicos.js';
import {
  type FirmaHistoria,
  MOTIVOS_SIN_FIRMA,
  type MotivoSinFirma,
  PARENTESCOS,
  type Parentesco,
  PROPOSITOS_FIRMA,
  type PropositoFirma,
  ROLES_FIRMANTE,
  type RolFirmante,
} from '../../domain/entities/firma_historia.js';

/** Campos de texto del formulario multipart. La imagen va aparte, en `imagen`. */
export class RegistrarFirmaHistoriaDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Generado en el celular (firma sin señal): reenviarlo no duplica',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ enum: ROLES_FIRMANTE })
  @IsIn(ROLES_FIRMANTE)
  rolFirmante: RolFirmante;

  @ApiProperty({
    enum: PROPOSITOS_FIRMA,
    description:
      'paciente y acudiente: comprobante_atencion o disentimiento; testigo: disentimiento; receptor: entrega',
  })
  @IsIn(PROPOSITOS_FIRMA)
  proposito: PropositoFirma;

  @ApiPropertyOptional({
    maxLength: 150,
    description:
      'Acudiente, testigo y receptor. El del paciente se toma de la historia',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombreFirmante?: string;

  @ApiPropertyOptional({
    enum: TIPOS_DOCUMENTO,
    description: 'Acudiente y testigo: solo de adulto (CC, CE, PA, PEP, PPT)',
  })
  @IsOptional()
  @IsIn(TIPOS_DOCUMENTO)
  tipoDocumento?: string;

  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  numeroDocumento?: string;

  @ApiPropertyOptional({ enum: PARENTESCOS, description: 'Solo acudiente' })
  @IsOptional()
  @IsIn(PARENTESCOS)
  parentesco?: Parentesco;

  @ApiPropertyOptional({ maxLength: 100, description: 'Solo receptor' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cargo?: string;

  @ApiPropertyOptional({
    enum: MOTIVOS_SIN_FIRMA,
    description:
      'Solo rolFirmante = paciente y sin imagen: por qué nadie pudo firmar',
  })
  @IsOptional()
  @IsIn(MOTIVOS_SIN_FIRMA)
  motivoSinFirma?: MotivoSinFirma;

  @ApiPropertyOptional({
    maxLength: 255,
    description: 'Obligatorio con motivo "otro"',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  detalleMotivo?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Cuándo se firmó en el celular. Por defecto, ahora',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  firmadaEn?: Date;
}

/** Solo para Swagger: el formulario completo. */
export class RegistrarFirmaHistoriaFormularioDto extends RegistrarFirmaHistoriaDto {
  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description:
      'PNG de la firma (máximo 200 KB, entre 150x50 y 2000x1000). No va si se envía motivoSinFirma',
  })
  imagen?: unknown;
}

class PersonaFirmaDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  nombreCompleto: string | null;
}

class ImagenFirmaHistoriaDto {
  @ApiProperty() tamanoBytes: number;
  @ApiProperty() anchoPx: number;
  @ApiProperty() altoPx: number;
  @ApiProperty({ description: 'SHA-256 de la imagen original' })
  huellaSha256: string;
}

export class FirmaHistoriaRespuestaDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: ROLES_FIRMANTE }) rolFirmante: RolFirmante;
  @ApiProperty({ enum: PROPOSITOS_FIRMA }) proposito: PropositoFirma;
  @ApiPropertyOptional({ type: String, nullable: true })
  nombreFirmante: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  tipoDocumento: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  numeroDocumento: string | null;
  @ApiPropertyOptional({ enum: PARENTESCOS, nullable: true })
  parentesco: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) cargo: string | null;
  @ApiPropertyOptional({
    type: ImagenFirmaHistoriaDto,
    nullable: true,
    description:
      'null si no firmó (ver motivoSinFirma). La imagen: GET /historias-clinicas/{id}/firmas/{firmaId}/imagen',
  })
  imagen: ImagenFirmaHistoriaDto | null;
  @ApiPropertyOptional({ enum: MOTIVOS_SIN_FIRMA, nullable: true })
  motivoSinFirma: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  detalleMotivo: string | null;
  @ApiProperty({ example: 'v1', description: 'Versión del texto que aceptó' })
  textoVersion: string;
  @ApiProperty() firmadaEn: Date;
  @ApiProperty({
    type: PersonaFirmaDto,
    description: 'Profesional que tomó la firma',
  })
  registradaPor: PersonaFirmaDto;

  static desde(f: FirmaHistoria): FirmaHistoriaRespuestaDto {
    return {
      id: f.id,
      rolFirmante: f.rolFirmante,
      proposito: f.proposito,
      nombreFirmante: f.nombreFirmante,
      tipoDocumento: f.tipoDocumento,
      numeroDocumento: f.numeroDocumento,
      parentesco: f.parentesco,
      cargo: f.cargo,
      imagen: f.imagen
        ? {
            tamanoBytes: f.imagen.tamanoBytes,
            anchoPx: f.imagen.anchoPx,
            altoPx: f.imagen.altoPx,
            huellaSha256: f.imagen.huellaSha256,
          }
        : null,
      motivoSinFirma: f.motivoSinFirma,
      detalleMotivo: f.detalleMotivo,
      textoVersion: f.textoVersion,
      firmadaEn: f.firmadaEn,
      registradaPor: {
        id: f.registradaPorId,
        nombreCompleto: f.registradaPorNombre,
      },
    };
  }
}
