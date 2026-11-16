import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import type {
  EstadoFirma,
  FirmaUsuario,
} from '../../domain/entities/firma_usuario.entity.js';

/** Los campos de texto del formulario multipart. La imagen llega aparte, en `imagen`. */
export class RegistrarMiFirmaDto {
  @ApiProperty({
    description:
      'Su contraseña, escrita en ese momento. No se guarda ni se registra',
    maxLength: 128,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  contrasena: string;
}

/** Solo para Swagger: describe el formulario completo. */
export class RegistrarMiFirmaFormularioDto extends RegistrarMiFirmaDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description:
      'PNG de la firma, máximo 200 KB, entre 150x50 y 2000x1000 píxeles. Fondo transparente o blanco',
  })
  imagen: unknown;
}

export class DesactivarFirmaDto {
  @ApiProperty({ minLength: 5, maxLength: 255 })
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  motivo: string;
}

export class FirmaUsuarioRespuestaDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) usuarioId: string;
  @ApiProperty({ enum: ['vigente', 'reemplazada', 'desactivada'] })
  estado: EstadoFirma;
  @ApiProperty({ example: 'image/png' }) tipoMime: string;
  @ApiProperty() tamanoBytes: number;
  @ApiProperty() anchoPx: number;
  @ApiProperty() altoPx: number;
  @ApiProperty({ description: 'SHA-256 de la imagen original' })
  huellaSha256: string;
  @ApiProperty() registradaEn: Date;
  @ApiPropertyOptional({ type: Date, nullable: true })
  reemplazadaEn: Date | null;
  @ApiPropertyOptional({ type: Date, nullable: true })
  desactivadaEn: Date | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  motivoDesactivacion: string | null;

  static desde(f: FirmaUsuario): FirmaUsuarioRespuestaDto {
    return {
      id: f.id,
      usuarioId: f.usuarioId,
      estado: f.estado,
      tipoMime: f.tipoMime,
      tamanoBytes: f.tamanoBytes,
      anchoPx: f.anchoPx,
      altoPx: f.altoPx,
      huellaSha256: f.huellaSha256,
      registradaEn: f.registradaEn,
      reemplazadaEn: f.reemplazadaEn,
      desactivadaEn: f.desactivadaEn,
      motivoDesactivacion: f.motivoDesactivacion,
    };
  }
}

export class MiFirmaRespuestaDto {
  @ApiProperty({
    description: 'false: debe registrarla antes de firmar historias',
  })
  registrada: boolean;
  @ApiPropertyOptional({ type: FirmaUsuarioRespuestaDto, nullable: true })
  firma: FirmaUsuarioRespuestaDto | null;

  static desde(firma: FirmaUsuario | null): MiFirmaRespuestaDto {
    return {
      registrada: firma !== null,
      firma: firma ? FirmaUsuarioRespuestaDto.desde(firma) : null,
    };
  }
}
