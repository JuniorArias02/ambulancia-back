import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import type { ChequeoIniciado } from '../../application/use-cases/iniciar_chequeo_diario.use-case.js';
import type { ChequeoDelDia } from '../../application/use-cases/obtener_mi_chequeo_del_dia.use-case.js';
import type { ChequeoConLista } from '../../application/use-cases/responder_chequeo_diario.use-case.js';
import {
  type ChequeoDiario,
  ESTADOS_CHEQUEO,
  type EstadoChequeo,
} from '../../domain/entities/chequeo_diario.entity.js';
import type { ListaChequeo } from '../../domain/entities/lista_chequeo.entity.js';
import { ListaChequeoRespuestaDto } from './lista_chequeo_respuesta.dto.js';

export class RespuestaChequeoRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  itemId: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Texto de la pregunta (solo con la lista cargada)',
  })
  pregunta: string | null;

  @ApiProperty({ format: 'uuid' })
  estadoId: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Bien',
    description: 'Nombre de la opción elegida (solo con la lista cargada)',
  })
  calificacion: string | null;

  @ApiProperty()
  tieneObservacion: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  observacion: string | null;

  @ApiProperty()
  respondidoEn: Date;
}

export class ChequeoDiarioRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '2026-11-10', description: 'Día de Colombia' })
  fecha: string;

  @ApiProperty({ enum: ESTADOS_CHEQUEO })
  estado: EstadoChequeo;

  @ApiPropertyOptional({ type: Date, nullable: true })
  iniciadoEn: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  finalizadoEn: Date | null;

  @ApiProperty({ format: 'uuid' })
  listaChequeoId: string;

  @ApiProperty({ format: 'uuid' })
  ambulanciaId: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'AMB-01' })
  ambulanciaCodigo: string | null;

  @ApiProperty({ format: 'uuid' })
  conductorId: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  conductorNombre: string | null;

  @ApiProperty({ type: [RespuestaChequeoRespuestaDto] })
  respuestas: RespuestaChequeoRespuestaDto[];

  @ApiProperty({
    type: [String],
    description:
      'Ids de preguntas obligatorias sin responder (vacío sin la lista)',
  })
  pendientes: string[];

  /** Con la lista, agrega el texto de la pregunta, la opción y los pendientes. */
  static desde(
    chequeo: ChequeoDiario,
    lista: ListaChequeo | null = null,
  ): ChequeoDiarioRespuestaDto {
    return {
      id: chequeo.id,
      fecha: chequeo.fecha,
      estado: chequeo.estado,
      iniciadoEn: chequeo.iniciadoEn,
      finalizadoEn: chequeo.finalizadoEn,
      listaChequeoId: chequeo.listaChequeoId,
      ambulanciaId: chequeo.ambulanciaId,
      ambulanciaCodigo: chequeo.ambulanciaCodigo,
      conductorId: chequeo.conductorId,
      conductorNombre: chequeo.conductorNombre,
      respuestas: chequeo.respuestas.map((r) => ({
        itemId: r.itemId,
        pregunta: lista?.buscarItem(r.itemId)?.pregunta ?? null,
        estadoId: r.estadoId,
        calificacion: lista?.buscarEstado(r.estadoId)?.nombre ?? null,
        tieneObservacion: r.tieneObservacion,
        observacion: r.observacion,
        respondidoEn: r.respondidoEn,
      })),
      pendientes: lista ? chequeo.pendientes(lista).map((i) => i.id) : [],
    };
  }

  static desdeConLista({ chequeo, lista }: ChequeoConLista) {
    return ChequeoDiarioRespuestaDto.desde(chequeo, lista);
  }
}

export class ChequeoDelDiaRespuestaDto {
  @ApiProperty({ example: '2026-11-10' })
  fecha: string;

  @ApiProperty({ format: 'uuid' })
  ambulanciaId: string;

  @ApiProperty({
    type: ListaChequeoRespuestaDto,
    description: 'Solo las preguntas y opciones activas',
  })
  lista: ListaChequeoRespuestaDto;

  @ApiPropertyOptional({
    type: ChequeoDiarioRespuestaDto,
    nullable: true,
    description: 'null si aún no lo inicia hoy',
  })
  chequeo: ChequeoDiarioRespuestaDto | null;

  static desde(delDia: ChequeoDelDia): ChequeoDelDiaRespuestaDto {
    return {
      fecha: delDia.fecha,
      ambulanciaId: delDia.ambulanciaId,
      lista: ListaChequeoRespuestaDto.desde(delDia.lista, true),
      chequeo: delDia.chequeo
        ? ChequeoDiarioRespuestaDto.desde(delDia.chequeo, delDia.lista)
        : null,
    };
  }
}

export class ChequeoIniciadoRespuestaDto extends ChequeoDelDiaRespuestaDto {
  @ApiProperty({ description: 'false si ya existía' })
  creado: boolean;

  static desdeIniciado(iniciado: ChequeoIniciado): ChequeoIniciadoRespuestaDto {
    const { fecha, ambulanciaId, lista, chequeo } =
      ChequeoDelDiaRespuestaDto.desde(iniciado);
    return { fecha, ambulanciaId, lista, chequeo, creado: iniciado.creado };
  }
}

export class ChequeosDiariosPaginadosRespuestaDto {
  @ApiProperty({ type: [ChequeoDiarioRespuestaDto] })
  datos: ChequeoDiarioRespuestaDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  pagina: number;

  @ApiProperty()
  limite: number;

  static desde(
    resultado: ResultadoPaginado<ChequeoDiario>,
  ): ChequeosDiariosPaginadosRespuestaDto {
    return {
      datos: resultado.datos.map((c) => ChequeoDiarioRespuestaDto.desde(c)),
      total: resultado.total,
      pagina: resultado.pagina,
      limite: resultado.limite,
    };
  }
}
