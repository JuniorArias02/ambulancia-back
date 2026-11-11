import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import type { ListaChequeo } from '../../domain/entities/lista_chequeo.entity.js';

export class PreguntaRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  pregunta: string;

  @ApiProperty()
  orden: number;

  @ApiProperty()
  obligatorio: boolean;

  @ApiProperty()
  permiteObservacion: boolean;

  @ApiProperty()
  activo: boolean;
}

export class OpcionRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Bien' })
  nombre: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  valor: number | null;

  @ApiProperty()
  orden: number;

  @ApiProperty()
  activo: boolean;
}

export class ListaChequeoRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  nombre: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  descripcion: string | null;

  @ApiProperty()
  activa: boolean;

  @ApiProperty()
  creadaEn: Date;

  @ApiPropertyOptional({ type: Date, nullable: true })
  actualizadaEn: Date | null;

  @ApiProperty({ type: [PreguntaRespuestaDto], description: 'Por orden' })
  items: PreguntaRespuestaDto[];

  @ApiProperty({ type: [OpcionRespuestaDto], description: 'Por orden' })
  estados: OpcionRespuestaDto[];

  /** `soloActivos`: lo que ve el conductor; el administrador ve todo. */
  static desde(
    lista: ListaChequeo,
    soloActivos = false,
  ): ListaChequeoRespuestaDto {
    const items = soloActivos
      ? lista.itemsActivos()
      : [...lista.items].sort((a, b) => a.orden - b.orden);
    const estados = soloActivos
      ? lista.estadosActivos()
      : [...lista.estados].sort((a, b) => a.orden - b.orden);
    return {
      id: lista.id,
      nombre: lista.nombre,
      descripcion: lista.descripcion,
      activa: lista.activa,
      creadaEn: lista.creadaEn,
      actualizadaEn: lista.actualizadaEn,
      items: items.map((i) => ({
        id: i.id,
        pregunta: i.pregunta,
        orden: i.orden,
        obligatorio: i.obligatorio,
        permiteObservacion: i.permiteObservacion,
        activo: i.activo,
      })),
      estados: estados.map((e) => ({
        id: e.id,
        nombre: e.nombre,
        valor: e.valor,
        orden: e.orden,
        activo: e.activo,
      })),
    };
  }
}

export class ListasChequeoPaginadasRespuestaDto {
  @ApiProperty({ type: [ListaChequeoRespuestaDto] })
  datos: ListaChequeoRespuestaDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  pagina: number;

  @ApiProperty()
  limite: number;

  static desde(
    resultado: ResultadoPaginado<ListaChequeo>,
  ): ListasChequeoPaginadasRespuestaDto {
    return {
      datos: resultado.datos.map((l) => ListaChequeoRespuestaDto.desde(l)),
      total: resultado.total,
      pagina: resultado.pagina,
      limite: resultado.limite,
    };
  }
}
