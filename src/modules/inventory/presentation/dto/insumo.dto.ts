import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginacionDto } from '../../../../common/dto/paginacion.dto.js';
import {
  TIPOS_INSUMO,
  type TipoInsumo,
} from '../../domain/entities/insumo.entity.js';
import { BooleanoDeConsulta, EsCantidad, SiSeEnvia } from './validadores.js';

export class CrearInsumoDto {
  @ApiProperty({
    maxLength: 50,
    example: 'MED-0001',
    description: 'Se guarda en mayúscula; único',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  codigo: string;

  @ApiProperty({ maxLength: 150, example: 'Solución salina 0.9% 500 ml' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descripcion?: string | null;

  @ApiProperty({ enum: TIPOS_INSUMO })
  @IsIn(TIPOS_INSUMO)
  tipo: TipoInsumo;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 100,
    example: 'Líquidos endovenosos',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  categoria?: string | null;

  @ApiProperty({ maxLength: 30, example: 'unidad' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  unidadMedida: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  marca?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  fabricante?: string | null;

  @ApiPropertyOptional({
    default: true,
    description: 'Se controla por lote (no compatible con requiereSerie)',
  })
  @IsOptional()
  @IsBoolean()
  requiereLote?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: 'Cada lote exige fecha de vencimiento (requiere lote)',
  })
  @IsOptional()
  @IsBoolean()
  requiereVencimiento?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: 'Lotes y equipos exigen un registro sanitario vigente',
  })
  @IsOptional()
  @IsBoolean()
  requiereRegistroSanitario?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: 'Equipo individual por número de serie',
  })
  @IsOptional()
  @IsBoolean()
  requiereSerie?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: 'Medicamento de control especial',
  })
  @IsOptional()
  @IsBoolean()
  esControlEspecial?: boolean;

  @ApiPropertyOptional({
    default: 0,
    description: 'Mínimo esperado en bodegas (alerta)',
  })
  @IsOptional()
  @EsCantidad()
  stockMinimo?: number;
}

/** Lo que no se envía no cambia. `codigo`, `nombre`, `tipo` y `unidadMedida` no aceptan null. */
export class ActualizarInsumoDto {
  @ApiPropertyOptional({ maxLength: 50 })
  @SiSeEnvia()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  codigo?: string;

  @ApiPropertyOptional({ maxLength: 150 })
  @SiSeEnvia()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre?: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descripcion?: string | null;

  @ApiPropertyOptional({ enum: TIPOS_INSUMO })
  @SiSeEnvia()
  @IsIn(TIPOS_INSUMO)
  tipo?: TipoInsumo;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  categoria?: string | null;

  @ApiPropertyOptional({ maxLength: 30 })
  @SiSeEnvia()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  unidadMedida?: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  marca?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  fabricante?: string | null;

  @ApiPropertyOptional({
    description: 'No se puede cambiar si ya tiene existencias o movimientos',
  })
  @SiSeEnvia()
  @IsBoolean()
  requiereLote?: boolean;

  @ApiPropertyOptional()
  @SiSeEnvia()
  @IsBoolean()
  requiereVencimiento?: boolean;

  @ApiPropertyOptional()
  @SiSeEnvia()
  @IsBoolean()
  requiereRegistroSanitario?: boolean;

  @ApiPropertyOptional({
    description: 'No se puede cambiar si ya tiene existencias o movimientos',
  })
  @SiSeEnvia()
  @IsBoolean()
  requiereSerie?: boolean;

  @ApiPropertyOptional()
  @SiSeEnvia()
  @IsBoolean()
  esControlEspecial?: boolean;

  @ApiPropertyOptional()
  @SiSeEnvia()
  @EsCantidad()
  stockMinimo?: number;
}

export class ConsultarInsumosDto extends PaginacionDto {
  @ApiPropertyOptional({ description: 'Código, nombre o categoría' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  busqueda?: string;

  @ApiPropertyOptional({ enum: TIPOS_INSUMO })
  @IsOptional()
  @IsIn(TIPOS_INSUMO)
  tipo?: TipoInsumo;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @BooleanoDeConsulta()
  activo?: boolean;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @BooleanoDeConsulta()
  esControlEspecial?: boolean;
}
