import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  DEAMBULACIONES,
  type Deambulacion,
  ESTADOS_MENTALES,
  type EstadoMental,
  NIVELES_RIESGO_CAIDA,
  type NivelRiesgoCaida,
  ORIGENES_REGISTRO,
  type OrigenRegistro,
} from '../../domain/catalogos_clinicos.js';
import {
  PUNTAJE_MAXIMO_DOWNTON,
  type ValoracionDownton,
} from '../../domain/entities/valoracion_downton.entity.js';

/** Un ítem de la escala: se envía siempre, true o false (false = no aplica / ninguno). */
function Item(descripcion: string) {
  return function (objetivo: object, propiedad: string) {
    ApiProperty({ type: Boolean, description: descripcion })(
      objetivo,
      propiedad,
    );
    IsBoolean()(objetivo, propiedad);
  };
}

/**
 * Valoración completa: todos los ítems son obligatorios. `puntajeTotal` y
 * `nivelRiesgo` no se aceptan (los calcula el backend; enviarlos da 400).
 */
export class RegistrarValoracionDowntonDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Generado en el celular (para trabajar sin señal). Reenviar el mismo id no duplica',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Cuándo se valoró. Por defecto, la hora del servidor',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  evaluadaEn?: Date;

  @Item('Caídas previas')
  caidasPrevias: boolean;

  @Item('Medicamento: tranquilizantes / sedantes')
  medTranquilizantesSedantes: boolean;
  @Item('Medicamento: diuréticos')
  medDiureticos: boolean;
  @Item('Medicamento: hipotensores (no diuréticos)')
  medHipotensores: boolean;
  @Item('Medicamento: antiparkinsonianos')
  medAntiparkinsonianos: boolean;
  @Item('Medicamento: antidepresivos')
  medAntidepresivos: boolean;
  @Item('Medicamento: otros')
  medOtros: boolean;

  @Item('Déficit sensorial: alteraciones visuales')
  deficitVisual: boolean;
  @Item('Déficit sensorial: alteraciones auditivas')
  deficitAuditivo: boolean;
  @Item('Déficit sensorial: extremidades (ictus, paresias, amputaciones…)')
  deficitExtremidades: boolean;

  @ApiProperty({ enum: ESTADOS_MENTALES })
  @IsIn(ESTADOS_MENTALES)
  estadoMental: EstadoMental;

  @ApiProperty({ enum: DEAMBULACIONES })
  @IsIn(DEAMBULACIONES)
  deambulacion: Deambulacion;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  observacion?: string;

  @ApiPropertyOptional({
    enum: ORIGENES_REGISTRO,
    default: 'manual',
    description: '`voz` exige `segmentoAudioId` (fase de escucha continua)',
  })
  @IsOptional()
  @IsIn(ORIGENES_REGISTRO)
  origen?: OrigenRegistro;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Solo con origen `voz`: segmento de una grabación de esta historia',
  })
  @IsOptional()
  @IsUUID()
  segmentoAudioId?: string;
}

class RegistradoPorDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  nombreCompleto: string | null;
}

export class ValoracionDowntonRespuestaDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) historiaClinicaId: string;
  @ApiProperty() evaluadaEn: Date;
  @ApiProperty() caidasPrevias: boolean;
  @ApiProperty() medTranquilizantesSedantes: boolean;
  @ApiProperty() medDiureticos: boolean;
  @ApiProperty() medHipotensores: boolean;
  @ApiProperty() medAntiparkinsonianos: boolean;
  @ApiProperty() medAntidepresivos: boolean;
  @ApiProperty() medOtros: boolean;
  @ApiProperty() deficitVisual: boolean;
  @ApiProperty() deficitAuditivo: boolean;
  @ApiProperty() deficitExtremidades: boolean;
  @ApiProperty({ enum: ESTADOS_MENTALES }) estadoMental: EstadoMental;
  @ApiProperty({ enum: DEAMBULACIONES }) deambulacion: Deambulacion;
  @ApiProperty({
    minimum: 0,
    maximum: PUNTAJE_MAXIMO_DOWNTON,
    description: 'Calculado por el backend',
  })
  puntajeTotal: number;
  @ApiProperty({
    enum: NIVELES_RIESGO_CAIDA,
    description: 'Calculado: puntaje >= 3 => alto',
  })
  nivelRiesgo: NivelRiesgoCaida;
  @ApiPropertyOptional({ type: String, nullable: true })
  observacion: string | null;
  @ApiProperty({ enum: ORIGENES_REGISTRO }) origen: OrigenRegistro;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  segmentoAudioId: string | null;
  @ApiProperty() confirmado: boolean;
  @ApiProperty({ type: RegistradoPorDto }) registradoPor: RegistradoPorDto;
  @ApiProperty() creadaEn: Date;

  static desde(v: ValoracionDownton): ValoracionDowntonRespuestaDto {
    const { registradoPorId, registradoPorNombre, ...resto } = v;
    return {
      ...resto,
      registradoPor: {
        id: registradoPorId,
        nombreCompleto: registradoPorNombre,
      },
    };
  }
}
