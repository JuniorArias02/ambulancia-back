import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginacionDto } from '../../../../common/dto/paginacion.dto.js';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import type { AlertasConFecha } from '../../application/use-cases/consultar_alertas_inventario.use-case.js';
import type { DotacionAmbulancia } from '../../application/use-cases/consultar_existencias.use-case.js';
import {
  ESTADOS_EQUIPO,
  type EstadoEquipo,
} from '../../domain/entities/equipo.entity.js';
import {
  type Existencia,
  esUtilizable,
} from '../../domain/entities/existencia.js';
import {
  TIPOS_INSUMO,
  type TipoInsumo,
} from '../../domain/entities/insumo.entity.js';
import type { PerfilDotacion } from '../../domain/entities/perfil_dotacion.entity.js';
import {
  TIPOS_UBICACION,
  type TipoUbicacion,
} from '../../domain/entities/ubicacion_inventario.entity.js';
import {
  ESTADOS_DOTACION,
  type EstadoDotacion,
} from '../../domain/services/comparacion_dotacion.js';
import { BooleanoDeConsulta, PaginaRespuestaDto } from './validadores.js';
import { UbicacionInventarioRespuestaDto } from './ubicacion.dto.js';

export class ConsultarExistenciasDto extends PaginacionDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  ubicacionId?: string;

  @ApiPropertyOptional({ enum: TIPOS_UBICACION })
  @IsOptional()
  @IsIn(TIPOS_UBICACION)
  tipoUbicacion?: TipoUbicacion;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  insumoId?: string;

  @ApiPropertyOptional({ enum: TIPOS_INSUMO })
  @IsOptional()
  @IsIn(TIPOS_INSUMO)
  tipoInsumo?: TipoInsumo;

  @ApiPropertyOptional({ description: 'Código o nombre del insumo' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  busqueda?: string;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description: 'Incluir las que quedaron en 0',
  })
  @IsOptional()
  @BooleanoDeConsulta()
  incluirAgotadas?: boolean;
}

export class ConsultarAlertasDto {
  @ApiPropertyOptional({
    default: 30,
    minimum: 0,
    maximum: 365,
    description: 'Días hacia adelante',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  dias?: number;
}

export class ExistenciaRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  ubicacionId: string;

  @ApiProperty({ enum: TIPOS_UBICACION })
  ubicacionTipo: TipoUbicacion;

  @ApiPropertyOptional({ type: String, nullable: true })
  ubicacionNombre: string | null;

  @ApiProperty({ format: 'uuid' })
  insumoId: string;

  @ApiProperty()
  insumoCodigo: string;

  @ApiProperty()
  insumoNombre: string;

  @ApiProperty()
  unidadMedida: string;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  loteId: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  numeroLote: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  loteVencimiento: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  equipoId: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  numeroSerie: string | null;

  @ApiPropertyOptional({ enum: ESTADOS_EQUIPO, nullable: true })
  equipoEstado: EstadoEquipo | null;

  @ApiProperty({ description: 'insumo:<id>, lote:<id> o equipo:<id>' })
  claveControl: string;

  @ApiProperty()
  cantidad: number;

  @ApiProperty({ description: 'Sin vencer y, si es equipo, operativo' })
  utilizable: boolean;

  @ApiProperty()
  actualizadaEn: Date;

  static desde(existencia: Existencia, hoy: string): ExistenciaRespuestaDto {
    return { ...existencia, utilizable: esUtilizable(existencia, hoy) };
  }
}

export class ExistenciasPaginadasRespuestaDto extends PaginaRespuestaDto {
  @ApiProperty({ type: [ExistenciaRespuestaDto] })
  datos: ExistenciaRespuestaDto[];

  static desde(
    resultado: ResultadoPaginado<Existencia>,
    hoy: string,
  ): ExistenciasPaginadasRespuestaDto {
    return {
      ...resultado,
      datos: resultado.datos.map((e) => ExistenciaRespuestaDto.desde(e, hoy)),
    };
  }
}

export class TotalInsumoRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  insumoId: string;

  @ApiProperty()
  insumoCodigo: string;

  @ApiProperty()
  insumoNombre: string;

  @ApiProperty()
  unidadMedida: string;

  @ApiProperty({ description: 'Se puede usar' })
  disponible: number;

  @ApiProperty({ description: 'Vencido o equipo fuera de operación' })
  noUtilizable: number;
}

export class ItemDotacionRespuestaDto extends TotalInsumoRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  detallePerfilId: string;

  @ApiProperty()
  cantidadRequerida: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  cantidadMinima: number | null;

  @ApiProperty()
  obligatorio: boolean;

  @ApiProperty({ description: 'Cuánto falta para lo requerido' })
  faltante: number;

  @ApiProperty({ enum: ESTADOS_DOTACION, description: 'bajo_minimo = crítico' })
  estado: EstadoDotacion;
}

export class PerfilResumenRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  codigo: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty()
  version: number;

  static desde(
    perfil: PerfilDotacion | null,
  ): PerfilResumenRespuestaDto | null {
    return perfil
      ? {
          id: perfil.id,
          codigo: perfil.codigo,
          nombre: perfil.nombre,
          version: perfil.version,
        }
      : null;
  }
}

export class DotacionRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  ambulanciaId: string;

  @ApiProperty({ example: 'AMB-01' })
  ambulanciaCodigo: string;

  @ApiProperty({
    example: '2026-11-11',
    description: 'Día con el que se evaluaron vencimientos',
  })
  fecha: string;

  @ApiPropertyOptional({
    type: UbicacionInventarioRespuestaDto,
    nullable: true,
    description: 'null: aún no habilitada en inventario',
  })
  ubicacion: UbicacionInventarioRespuestaDto | null;

  @ApiPropertyOptional({
    type: PerfilResumenRespuestaDto,
    nullable: true,
    description: 'null: su tipo no tiene perfil vigente',
  })
  perfil: PerfilResumenRespuestaDto | null;

  @ApiPropertyOptional({
    type: Boolean,
    nullable: true,
    description: 'Todos los obligatorios completos; null sin perfil',
  })
  completa: boolean | null;

  @ApiProperty({ type: [ItemDotacionRespuestaDto] })
  items: ItemDotacionRespuestaDto[];

  @ApiProperty({
    type: [TotalInsumoRespuestaDto],
    description: 'Lo que hay y el perfil no pide',
  })
  adicionales: TotalInsumoRespuestaDto[];

  @ApiProperty({
    type: [ExistenciaRespuestaDto],
    description: 'Detalle por lote y equipo',
  })
  existencias: ExistenciaRespuestaDto[];

  static desde(dotacion: DotacionAmbulancia): DotacionRespuestaDto {
    return {
      ambulanciaId: dotacion.ambulanciaId,
      ambulanciaCodigo: dotacion.ambulanciaCodigo,
      fecha: dotacion.fecha,
      ubicacion: dotacion.ubicacion
        ? UbicacionInventarioRespuestaDto.desde(dotacion.ubicacion)
        : null,
      perfil: PerfilResumenRespuestaDto.desde(dotacion.perfil),
      completa: dotacion.comparacion.completa,
      items: dotacion.comparacion.items.map((i) => ({ ...i })),
      adicionales: dotacion.comparacion.adicionales.map((a) => ({ ...a })),
      existencias: dotacion.existencias.map((e) =>
        ExistenciaRespuestaDto.desde(e, dotacion.fecha),
      ),
    };
  }
}

class LoteEnRiesgoRespuestaDto {
  @ApiProperty({ format: 'uuid' }) loteId: string;
  @ApiProperty() numeroLote: string;
  @ApiProperty() fechaVencimiento: string;
  @ApiProperty({ format: 'uuid' }) insumoId: string;
  @ApiProperty() insumoNombre: string;
  @ApiProperty({ format: 'uuid' }) ubicacionId: string;
  @ApiPropertyOptional({ type: String, nullable: true }) ubicacionNombre:
    string | null;
  @ApiProperty() cantidad: number;
}

class EquipoPorMantenimientoRespuestaDto {
  @ApiProperty({ format: 'uuid' }) equipoId: string;
  @ApiProperty() numeroSerie: string;
  @ApiProperty() insumoNombre: string;
  @ApiProperty({ enum: ESTADOS_EQUIPO }) estado: EstadoEquipo;
  @ApiProperty() fechaProximoMantenimiento: string;
}

class RegistroPorVencerRespuestaDto {
  @ApiProperty({ format: 'uuid' }) registroId: string;
  @ApiProperty() numeroRegistro: string;
  @ApiProperty({ format: 'uuid' }) insumoId: string;
  @ApiProperty() insumoNombre: string;
  @ApiProperty() fechaVencimiento: string;
}

class InsumoBajoMinimoRespuestaDto {
  @ApiProperty({ format: 'uuid' }) insumoId: string;
  @ApiProperty() insumoCodigo: string;
  @ApiProperty() insumoNombre: string;
  @ApiProperty() unidadMedida: string;
  @ApiProperty() stockMinimo: number;
  @ApiProperty({ description: 'Suma en bodegas activas' }) enBodegas: number;
}

export class AlertasRespuestaDto {
  @ApiProperty({ example: '2026-12-11', description: 'Hasta qué día se buscó' })
  hasta: string;

  @ApiProperty({
    type: [LoteEnRiesgoRespuestaDto],
    description: 'Con existencias; incluye los ya vencidos',
  })
  lotesPorVencer: LoteEnRiesgoRespuestaDto[];

  @ApiProperty({ type: [EquipoPorMantenimientoRespuestaDto] })
  equiposPorMantenimiento: EquipoPorMantenimientoRespuestaDto[];

  @ApiProperty({ type: [RegistroPorVencerRespuestaDto] })
  registrosPorVencer: RegistroPorVencerRespuestaDto[];

  @ApiProperty({ type: [InsumoBajoMinimoRespuestaDto] })
  insumosBajoMinimo: InsumoBajoMinimoRespuestaDto[];

  static desde(alertas: AlertasConFecha): AlertasRespuestaDto {
    return { ...alertas };
  }
}
