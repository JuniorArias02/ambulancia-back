import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  AccesoDenegadoError,
  ConflictoNegocioError,
  ErrorDominio,
  NoAutenticadoError,
  RecursoNoEncontradoError,
  ReglaNegocioError,
  ServicioNoDisponibleError,
} from '../exceptions/errores_dominio.js';

interface RespuestaError {
  codigoEstado: number;
  error: string;
  mensaje: string | string[];
  ruta: string;
  fecha: string;
}

@Catch()
export class FiltroExcepciones implements ExceptionFilter {
  private readonly logger = new Logger(FiltroExcepciones.name);

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const contexto = host.switchToHttp();
    const respuesta = contexto.getResponse<Response>();
    const solicitud = contexto.getRequest<Request>();

    const { codigoEstado, mensaje } = this.resolver(excepcion, solicitud);

    const cuerpo: RespuestaError = {
      codigoEstado,
      error: HttpStatus[codigoEstado] ?? 'ERROR',
      mensaje,
      ruta: solicitud.url,
      fecha: new Date().toISOString(),
    };

    respuesta.status(codigoEstado).json(cuerpo);
  }

  private resolver(
    excepcion: unknown,
    solicitud: Request,
  ): { codigoEstado: number; mensaje: string | string[] } {
    if (excepcion instanceof ErrorDominio) {
      return {
        codigoEstado: this.codigoParaErrorDominio(excepcion),
        mensaje: excepcion.message,
      };
    }

    if (excepcion instanceof HttpException) {
      return {
        codigoEstado: excepcion.getStatus(),
        mensaje: this.mensajeHttp(excepcion),
      };
    }

    this.logger.error(
      `Error no controlado en ${solicitud.method} ${solicitud.path}`,
      excepcion instanceof Error ? excepcion.stack : String(excepcion),
    );

    return {
      codigoEstado: HttpStatus.INTERNAL_SERVER_ERROR,
      mensaje: 'Error interno del servidor',
    };
  }

  private codigoParaErrorDominio(error: ErrorDominio): HttpStatus {
    if (error instanceof RecursoNoEncontradoError) return HttpStatus.NOT_FOUND;
    if (error instanceof ConflictoNegocioError) return HttpStatus.CONFLICT;
    if (error instanceof ReglaNegocioError)
      return HttpStatus.UNPROCESSABLE_ENTITY;
    if (error instanceof NoAutenticadoError) return HttpStatus.UNAUTHORIZED;
    if (error instanceof AccesoDenegadoError) return HttpStatus.FORBIDDEN;
    if (error instanceof ServicioNoDisponibleError)
      return HttpStatus.SERVICE_UNAVAILABLE;
    return HttpStatus.BAD_REQUEST;
  }

  private mensajeHttp(excepcion: HttpException): string | string[] {
    const cuerpo = excepcion.getResponse();
    if (typeof cuerpo === 'object' && 'message' in cuerpo) {
      const { message } = cuerpo;
      if (typeof message === 'string') return message;
      if (Array.isArray(message)) return message.map(String);
    }
    return excepcion.message;
  }
}
