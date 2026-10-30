import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  DESENLACES,
  type Desenlace,
  REGIONES_CORPORALES,
  type RegionCorporal,
  ROLES_VICTIMA,
  type RolVictima,
  SEXOS,
  type Sexo,
  TIPOS_DOCUMENTO,
  TIPOS_EVENTO,
  TIPOS_INTERVENCION,
  TIPOS_LESION,
  type TipoDocumento,
  type TipoEvento,
  type TipoIntervencion,
  type TipoLesion,
  TRIAGES,
  type Triage,
} from '../../domain/catalogos_clinicos.js';

/** Valida el campo solo si viene con valor; `null` borra el dato. */
const SiTieneValor = () =>
  ValidateIf((_objeto, valor) => valor !== undefined && valor !== null);

/** Texto opcional que se puede borrar con null. */
function Texto(maximo: number) {
  return function (objetivo: object, propiedad: string) {
    ApiPropertyOptional({ type: String, nullable: true, maxLength: maximo })(
      objetivo,
      propiedad,
    );
    SiTieneValor()(objetivo, propiedad);
    IsString()(objetivo, propiedad);
    MaxLength(maximo)(objetivo, propiedad);
  };
}

export class AbrirHistoriaClinicaDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Generado en el celular (para trabajar sin señal). Reenviar el mismo id no duplica',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({
    format: 'uuid',
    description: 'asignacion.id de GET /mi-servicio',
  })
  @IsUUID()
  asignacionId: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Hora de apertura en el celular',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  abiertaEn?: Date;
}

/** Todo opcional: se envía solo lo que cambia. `null` borra el dato. */
export class ActualizarHistoriaClinicaDto {
  // --- Paciente ---
  @ApiPropertyOptional({ description: 'false = NN (paciente sin identificar)' })
  @IsOptional()
  @IsBoolean()
  pacienteIdentificado?: boolean;

  @Texto(150) nombres?: string | null;
  @Texto(150) apellidos?: string | null;

  @ApiPropertyOptional({ enum: TIPOS_DOCUMENTO, nullable: true })
  @SiTieneValor()
  @IsIn(TIPOS_DOCUMENTO)
  tipoDocumento?: TipoDocumento | null;

  @Texto(40) numeroDocumento?: string | null;

  @ApiPropertyOptional({ enum: SEXOS, nullable: true })
  @SiTieneValor()
  @IsIn(SEXOS)
  sexo?: Sexo | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: 120,
  })
  @SiTieneValor()
  @IsInt()
  @Min(0)
  @Max(120)
  edadAproximada?: number | null;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @SiTieneValor()
  @Type(() => Date)
  @IsDate()
  fechaNacimiento?: Date | null;

  @Texto(120) aseguradoraEps?: string | null;
  @Texto(150) acompananteNombre?: string | null;
  @Texto(30) acompananteTelefono?: string | null;

  // --- Evento ---
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @SiTieneValor()
  @Type(() => Date)
  @IsDate()
  horaEvento?: Date | null;

  @ApiPropertyOptional({ enum: TIPOS_EVENTO, nullable: true })
  @SiTieneValor()
  @IsIn(TIPOS_EVENTO)
  tipoEvento?: TipoEvento | null;

  @Texto(5000) mecanismoLesion?: string | null;

  @ApiPropertyOptional({
    enum: ROLES_VICTIMA,
    nullable: true,
    description: 'Solo en tránsito',
  })
  @SiTieneValor()
  @IsIn(ROLES_VICTIMA)
  rolVictima?: RolVictima | null;

  @Texto(100) elementosProteccion?: string | null;
  @Texto(20) placaVehiculo?: string | null;
  @Texto(60) polizaSoat?: string | null;

  // --- Valoración primaria XABCDE ---
  @Texto(255) xHemorragiaMasiva?: string | null;
  @Texto(255) aViaAerea?: string | null;
  @Texto(255) bRespiracion?: string | null;
  @Texto(255) cCirculacion?: string | null;
  @Texto(255) dNeurologico?: string | null;
  @Texto(255) eExposicion?: string | null;

  @ApiPropertyOptional({ enum: TRIAGES, nullable: true })
  @SiTieneValor()
  @IsIn(TRIAGES)
  triage?: Triage | null;

  // --- Antecedentes ---
  @Texto(255) alergias?: string | null;
  @Texto(255) medicamentosHabituales?: string | null;
  @Texto(255) antecedentes?: string | null;
  @Texto(5000) impresionDiagnostica?: string | null;
  @Texto(5000) observaciones?: string | null;

  // --- Desenlace y entrega ---
  @ApiPropertyOptional({ enum: DESENLACES, nullable: true })
  @SiTieneValor()
  @IsIn(DESENLACES)
  desenlace?: Desenlace | null;

  @Texto(5000) motivoRechazo?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Id de GET /instituciones-salud',
  })
  @SiTieneValor()
  @IsUUID()
  institucionDestinoId?: string | null;

  @Texto(5000) condicionEntrega?: string | null;
  @Texto(150) receptorNombre?: string | null;
  @Texto(100) receptorCargo?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @SiTieneValor()
  @Type(() => Date)
  @IsDate()
  entregadoEn?: Date | null;
}

/** Rangos fisiológicamente posibles: atrapan errores de digitación, no valores clínicos extremos. */
export class RegistrarSignoVitalDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Generado en el celular; reenviarlo no duplica',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Por defecto, ahora',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  medidoEn?: Date;

  @ApiPropertyOptional({ minimum: 0, maximum: 300 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300)
  presionSistolica?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 250 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(250)
  presionDiastolica?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 300 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300)
  frecuenciaCardiaca?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 80 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(80)
  frecuenciaRespiratoria?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  saturacionOxigeno?: number;

  @ApiPropertyOptional({
    minimum: 25,
    maximum: 45,
    description: '°C, 1 decimal',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(25)
  @Max(45)
  temperatura?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 1000, description: 'mg/dL' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  glucometria?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  glasgowOcular?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  glasgowVerbal?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 6 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  glasgowMotor?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  escalaDolor?: number;
}

export class RegistrarLesionDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ enum: REGIONES_CORPORALES })
  @IsIn(REGIONES_CORPORALES)
  regionCorporal: RegionCorporal;

  @ApiProperty({ enum: TIPOS_LESION })
  @IsIn(TIPOS_LESION)
  tipoLesion: TipoLesion;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;
}

export class RegistrarIntervencionDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ enum: TIPOS_INTERVENCION })
  @IsIn(TIPOS_INTERVENCION)
  tipo: TipoIntervencion;

  @ApiProperty({ maxLength: 150, example: 'Inmovilización cervical' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nombre: string;

  @ApiPropertyOptional({ maxLength: 60, example: '500 ml' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  dosis?: string;

  @ApiPropertyOptional({ maxLength: 40, example: 'intravenosa' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  via?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Por defecto, ahora',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  realizadoEn?: Date;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  resultado?: string;
}

export class AnularHistoriaClinicaDto {
  @ApiProperty({ minLength: 5, maxLength: 255 })
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  motivo: string;
}

export class ConsultarHistoriasClinicasDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  asignacionId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Solo el administrador' })
  @IsOptional()
  @IsUUID()
  emergenciaId?: string;
}
