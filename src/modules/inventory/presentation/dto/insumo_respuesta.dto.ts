import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import {
  type ControlInsumo,
  type Insumo,
  TIPOS_INSUMO,
  type TipoInsumo,
} from '../../domain/entities/insumo.entity.js';
import { PaginaRespuestaDto } from './validadores.js';

export class InsumoRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'MED-0001' })
  codigo: string;

  @ApiProperty()
  nombre: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  descripcion: string | null;

  @ApiProperty({ enum: TIPOS_INSUMO })
  tipo: TipoInsumo;

  @ApiPropertyOptional({ type: String, nullable: true })
  categoria: string | null;

  @ApiProperty({ example: 'unidad' })
  unidadMedida: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  marca: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  fabricante: string | null;

  @ApiProperty()
  requiereLote: boolean;

  @ApiProperty()
  requiereVencimiento: boolean;

  @ApiProperty()
  requiereRegistroSanitario: boolean;

  @ApiProperty()
  requiereSerie: boolean;

  @ApiProperty()
  esControlEspecial: boolean;

  @ApiProperty({
    enum: ['serie', 'lote', 'insumo'],
    description:
      'Qué debe indicar al moverlo o contarlo: equipoId (serie), loteId (lote) o nada',
  })
  control: ControlInsumo;

  @ApiProperty()
  stockMinimo: number;

  @ApiProperty()
  activo: boolean;

  @ApiProperty()
  creadoEn: Date;

  @ApiProperty()
  actualizadoEn: Date;

  static desde(insumo: Insumo): InsumoRespuestaDto {
    return {
      id: insumo.id,
      codigo: insumo.codigo,
      nombre: insumo.nombre,
      descripcion: insumo.descripcion,
      tipo: insumo.tipo,
      categoria: insumo.categoria,
      unidadMedida: insumo.unidadMedida,
      marca: insumo.marca,
      fabricante: insumo.fabricante,
      requiereLote: insumo.requiereLote,
      requiereVencimiento: insumo.requiereVencimiento,
      requiereRegistroSanitario: insumo.requiereRegistroSanitario,
      requiereSerie: insumo.requiereSerie,
      esControlEspecial: insumo.esControlEspecial,
      control: insumo.control,
      stockMinimo: insumo.stockMinimo,
      activo: insumo.activo,
      creadoEn: insumo.creadoEn,
      actualizadoEn: insumo.actualizadoEn,
    };
  }
}

export class InsumosPaginadosRespuestaDto extends PaginaRespuestaDto {
  @ApiProperty({ type: [InsumoRespuestaDto] })
  datos: InsumoRespuestaDto[];

  static desde(
    resultado: ResultadoPaginado<Insumo>,
  ): InsumosPaginadosRespuestaDto {
    return {
      ...resultado,
      datos: resultado.datos.map((i) => InsumoRespuestaDto.desde(i)),
    };
  }
}
