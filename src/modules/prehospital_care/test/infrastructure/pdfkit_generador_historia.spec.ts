import { inflateSync } from 'node:zlib';
import { HistoriaClinica } from '../../domain/entities/historia_clinica.entity.js';
import type { DocumentoHistoriaPdf } from '../../domain/services/generador_pdf_historia.js';
import { PdfkitGeneradorHistoria } from '../../infrastructure/services/pdfkit_generador_historia.service.js';
import { crearPngPrueba } from '../../../signatures/test/dobles/firmas_memoria.js';

/**
 * Texto de las páginas: pdfkit comprime cada contenido con deflate y escribe
 * el texto en hexadecimal, partido por el interletrado (`[<4162> 10 <63>] TJ`).
 */
function textoDelPdf(pdf: Uint8Array): string {
  const binario = Buffer.from(pdf).toString('latin1');
  const lineas: string[] = [];
  for (const m of binario.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let contenido: string;
    try {
      contenido = inflateSync(Buffer.from(m[1] ?? '', 'latin1')).toString(
        'latin1',
      );
    } catch {
      continue; // imágenes u otros flujos que no son texto
    }
    for (const arreglo of contenido.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
      const hex = [...(arreglo[1] ?? '').matchAll(/<([0-9a-fA-F]*)>/g)]
        .map((h) => h[1] ?? '')
        .join('');
      lineas.push(Buffer.from(hex, 'hex').toString('latin1'));
    }
  }
  return lineas.join('\n');
}

function documento(estado: 'borrador' | 'cerrada'): DocumentoHistoriaPdf {
  const historia = HistoriaClinica.abrir({
    id: 'h1',
    numeroHistoria: 'HC-20261115-0001',
    emergenciaId: 'e1',
    asignacionId: 'a1',
    creadaPorId: 'p1',
    abiertaEn: new Date('2026-11-15T15:00:00Z'),
    sincronizadaEn: new Date('2026-11-15T15:00:00Z'),
    datosIniciales: {
      pacienteIdentificado: true,
      nombres: 'Rosa',
      apellidos: 'Díaz',
      triage: 'amarillo',
      desenlace: 'trasladado',
      alergias: 'Penicilina',
    },
  });
  return {
    detalle: {
      historia,
      signosVitales: [
        {
          id: 's1',
          historiaClinicaId: 'h1',
          medidoEn: new Date('2026-11-15T15:05:00Z'),
          presionSistolica: 120,
          presionDiastolica: 80,
          frecuenciaCardiaca: 88,
          frecuenciaRespiratoria: 18,
          saturacionOxigeno: 96,
          temperatura: 36.5,
          glucometria: null,
          glasgowOcular: 4,
          glasgowVerbal: 5,
          glasgowMotor: 6,
          glasgowTotal: 15,
          escalaDolor: 3,
          registradoPorId: 'p1',
          registradoPorNombre: 'Lucía Rojas',
        },
      ],
      lesiones: [],
      intervenciones: [],
      valoracionesDownton: [],
      firmasHistoria: [],
    },
    firmaProfesional:
      estado === 'cerrada'
        ? {
            nombre: 'Lucía Rojas',
            firmadaEn: new Date('2026-11-15T16:00:00Z'),
            codigoVerificacion: 'ABCDEF123456',
            imagen: crearPngPrueba(600, 200),
          }
        : null,
    firmas: [
      {
        firma: {
          id: 'f1',
          historiaClinicaId: 'h1',
          rolFirmante: 'receptor',
          proposito: 'entrega',
          nombreFirmante: 'Dra. Ruiz',
          tipoDocumento: null,
          numeroDocumento: null,
          parentesco: null,
          cargo: 'Médica de urgencias',
          imagen: null,
          motivoSinFirma: null,
          detalleMotivo: null,
          textoVersion: 'v1',
          firmadaEn: new Date('2026-11-15T15:55:00Z'),
          registradaPorId: 'p1',
          registradaPorNombre: 'Lucía Rojas',
        },
        imagen: crearPngPrueba(600, 200),
      },
    ],
    textosFirma: { entrega: 'Declaro que recibí al paciente.' },
    declaracionProfesional: 'Declaro que la información es veraz.',
    generadoEn: new Date('2026-11-15T17:00:00Z'),
    generadoPor: 'Administrador',
  };
}

describe('PdfkitGeneradorHistoria', () => {
  const generador = new PdfkitGeneradorHistoria('Ambulancias de Prueba');

  it('genera un PDF válido con los datos, la tabla de signos y las firmas', async () => {
    const pdf = await generador.generar(documento('cerrada'));
    const binario = Buffer.from(pdf).toString('latin1');
    expect(binario.startsWith('%PDF-')).toBe(true);
    expect(binario.trimEnd().endsWith('%%EOF')).toBe(true);

    const texto = textoDelPdf(pdf);
    for (const esperado of [
      'Ambulancias de Prueba',
      'HC-20261115-0001',
      'Penicilina',
      'Amarillo',
      'Dra. Ruiz',
      'ABCDEF123456',
    ]) {
      expect(texto).toContain(esperado);
    }
    // Las dos firmas van como imágenes.
    expect(
      binario.match(/\/Subtype \/Image/g)?.length ?? 0,
    ).toBeGreaterThanOrEqual(2);
  });

  it('una historia en curso lo advierte y no trae firma del profesional', async () => {
    const texto = textoDelPdf(await generador.generar(documento('borrador')));
    expect(texto).toContain('HISTORIA EN CURSO');
    expect(texto).toContain('no tiene la firma del profesional');
  });
});
