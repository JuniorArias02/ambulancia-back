import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import type { InstitucionConDistancia } from '../../application/use-cases/consultar_instituciones_salud.use-case.js';
import {
  type InstitucionSalud,
  NIVELES_COMPLEJIDAD,
  type NivelComplejidad,
} from '../../domain/entities/institucion_salud.entity.js';

class CoordenadasInstitucionDto {
  @ApiProperty()
  latitud: number;

  @ApiProperty()
  longitud: number;
}

export class InstitucionSaludRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  nombre: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  codigoHabilitacion: string | null;

  @ApiPropertyOptional({ enum: NIVELES_COMPLEJIDAD, nullable: true })
  nivelComplejidad: NivelComplejidad | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  telefono: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  direccion: string | null;

  @ApiPropertyOptional({ type: CoordenadasInstitucionDto, nullable: true })
  coordenadas: CoordenadasInstitucionDto | null;

  @ApiProperty()
  activa: boolean;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Solo si se consultó con latitud y longitud',
  })
  distanciaMetros?: number | null;

  static desde(
    institucion: InstitucionSalud,
    distanciaMetros?: number | null,
  ): InstitucionSaludRespuestaDto {
    return {
      id: institucion.id,
      nombre: institucion.nombre,
      codigoHabilitacion: institucion.codigoHabilitacion,
      nivelComplejidad: institucion.nivelComplejidad,
      telefono: institucion.telefono,
      direccion: institucion.direccion,
      coordenadas: institucion.coordenadas,
      activa: institucion.activa,
      ...(distanciaMetros !== undefined && { distanciaMetros }),
    };
  }
}

export class InstitucionesPaginadasRespuestaDto {
  @ApiProperty({ type: [InstitucionSaludRespuestaDto] })
  datos: InstitucionSaludRespuestaDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  pagina: number;

  @ApiProperty()
  limite: number;

  static desde(
    resultado: ResultadoPaginado<InstitucionConDistancia>,
    conDistancia: boolean,
  ): InstitucionesPaginadasRespuestaDto {
    return {
      ...resultado,
      datos: resultado.datos.map(({ institucion, distanciaMetros }) =>
        InstitucionSaludRespuestaDto.desde(
          institucion,
          conDistancia ? distanciaMetros : undefined,
        ),
      ),
    };
  }
}
