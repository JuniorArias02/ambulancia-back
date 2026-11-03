import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

export class VariablesEntorno {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production';

  @IsInt()
  @Min(1)
  @Max(65535)
  PUERTO: number;

  @IsString()
  @IsNotEmpty()
  CORS_ORIGENES: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @MinLength(32)
  JWT_SECRETO: string;

  @IsInt()
  @Min(60)
  @Max(86400)
  JWT_EXPIRACION_SEGUNDOS: number;

  /** Opcional: sin clave, la geocodificación responde 503 en vez de romper el arranque. */
  @IsOptional()
  @IsString()
  GEOAPIFY_API_KEY?: string;

  /** Proveedores en orden de uso; el siguiente actúa como respaldo. */
  @IsOptional()
  @Matches(/^[a-z_]+(,[a-z_]+)*$/, {
    message:
      'GEOCODIFICACION_PROVEEDORES debe ser una lista separada por comas',
  })
  GEOCODIFICACION_PROVEEDORES?: string;

  @IsOptional()
  @Matches(/^[a-z]{2}$/, {
    message: 'GEOCODIFICACION_PAIS debe ser un código ISO de 2 letras',
  })
  GEOCODIFICACION_PAIS?: string;

  /** Ciudad que se asume cuando la solicitud no la trae. */
  @IsOptional()
  @IsString()
  GEOCODIFICACION_CIUDAD_PREDETERMINADA?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  GEOCODIFICACION_CONFIANZA_MINIMA?: number;

  @IsOptional()
  @IsInt()
  @Min(500)
  @Max(30000)
  GEOCODIFICACION_TIEMPO_ESPERA_MS?: number;

  /** Geocodificación inversa: más lejos que esto, la calle ya no describe el punto. */
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(1000)
  GEOCODIFICACION_INVERSA_DISTANCIA_MAXIMA_M?: number;

  /** Proveedores de rutas en orden de uso; el siguiente actúa como respaldo. */
  @IsOptional()
  @Matches(/^[a-z_]+(,[a-z_]+)*$/, {
    message: 'RUTAS_PROVEEDORES debe ser una lista separada por comas',
  })
  RUTAS_PROVEEDORES?: string;

  /** A cuántos metros de la ruta vigente se recalcula por desvío. */
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(2000)
  RUTAS_DISTANCIA_DESVIO_M?: number;

  /** Mínimo entre dos recálculos del mismo servicio (cuida la cuota). */
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(3600)
  RUTAS_INTERVALO_RECALCULO_S?: number;

  @IsOptional()
  @IsInt()
  @Min(500)
  @Max(30000)
  RUTAS_TIEMPO_ESPERA_MS?: number;

  /** Radio de referencia (m) para que el conductor confirme la llegada a la escena. */
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(1000)
  ASIGNACIONES_RADIO_LLEGADA_M?: number;

  /**
   * Carpeta privada para las fotos de los documentos de identidad. Nunca debe
   * servirse por HTTP. Relativa a la carpeta desde donde arranca la API.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  ALMACENAMIENTO_PRIVADO_RUTA?: string;

  /**
   * Servidor de tiempo real (proyecto `webSocket/`). Opcional: sin URL o sin
   * clave, la API funciona igual pero no envía notificaciones. Vacías en el
   * `.env` cuentan como no configuradas.
   */
  @ValidateIf((variables: VariablesEntorno) => !!variables.TIEMPO_REAL_URL)
  @IsUrl({ require_tld: false, require_protocol: true })
  TIEMPO_REAL_URL?: string;

  /** Secreto compartido con el servidor de tiempo real, en ambos sentidos. */
  @ValidateIf(
    (variables: VariablesEntorno) => !!variables.TIEMPO_REAL_CLAVE_INTERNA,
  )
  @IsString()
  @MinLength(32)
  TIEMPO_REAL_CLAVE_INTERNA?: string;
}

export function validarVariablesEntorno(
  configuracion: Record<string, unknown>,
): VariablesEntorno {
  const variables = plainToInstance(VariablesEntorno, configuracion, {
    enableImplicitConversion: true,
  });
  const errores = validateSync(variables, { skipMissingProperties: false });

  if (errores.length > 0) {
    const detalle = errores
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Variables de entorno inválidas: ${detalle}`);
  }

  return variables;
}
