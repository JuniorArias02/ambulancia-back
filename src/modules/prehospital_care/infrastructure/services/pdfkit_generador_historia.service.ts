import PDFDocument from 'pdfkit';
import { etiqueta, legible } from '../../domain/etiquetas_clinicas.js';
import {
  type DocumentoHistoriaPdf,
  GeneradorPdfHistoria,
} from '../../domain/services/generador_pdf_historia.js';

type Documento = InstanceType<typeof PDFDocument>;
type Campo = [string, string | number | null | undefined];

const MARGEN = 40;
const ANCHO_UTIL = 595.28 - MARGEN * 2; // A4
const GRIS = '#555555';
const SIN_DATO = 'Sin dato';

const formatoFechaHora = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const formatoHora = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function fechaHora(fecha: Date | null): string | null {
  return fecha ? `${formatoFechaHora.format(fecha)} (hora de Colombia)` : null;
}

/** Las fechas de nacimiento se guardan a medianoche UTC: no se convierten de zona. */
function soloFecha(fecha: Date | null): string | null {
  if (!fecha) return null;
  const iso = fecha.toISOString().slice(0, 10);
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/**
 * PDF de la historia clínica con pdfkit: A4, secciones con títulos, tabla de
 * signos vitales y bloques de firma con su imagen. Cada página lleva el
 * número de historia, el estado y la paginación.
 */
export class PdfkitGeneradorHistoria extends GeneradorPdfHistoria {
  constructor(private readonly nombreEmpresa: string) {
    super();
  }

  generar(documento: DocumentoHistoriaPdf): Promise<Uint8Array> {
    return new Promise((resolver, rechazar) => {
      const pdf: Documento = new PDFDocument({
        size: 'A4',
        margin: MARGEN,
        bufferPages: true,
        info: {
          Title: `Historia clínica ${documento.detalle.historia.numeroHistoria}`,
          Author: this.nombreEmpresa,
        },
      });
      const partes: Buffer[] = [];
      pdf.on('data', (parte: Buffer) => partes.push(parte));
      pdf.on('end', () => resolver(new Uint8Array(Buffer.concat(partes))));
      pdf.on('error', rechazar);
      try {
        this.escribir(pdf, documento);
        this.paginar(pdf, documento);
        pdf.end();
      } catch (error) {
        rechazar(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private escribir(pdf: Documento, d: DocumentoHistoriaPdf): void {
    const { historia, signosVitales, lesiones, intervenciones } = d.detalle;
    const datos = historia.datos;

    pdf.font('Helvetica-Bold').fontSize(14).text(this.nombreEmpresa);
    pdf
      .font('Helvetica')
      .fontSize(11)
      .text('Historia clínica de atención prehospitalaria');
    pdf.moveDown(0.3);
    pdf
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(
        `${historia.numeroHistoria}   ·   Ingreso ${historia.numeroEmergencia ?? SIN_DATO}`,
      );
    pdf.moveDown(0.5);

    if (historia.estado !== 'cerrada') {
      const aviso =
        historia.estado === 'anulada'
          ? 'HISTORIA ANULADA: el contenido se conserva, pero no es válido.'
          : 'HISTORIA EN CURSO: aún no está firmada ni cerrada; los datos pueden cambiar.';
      this.recuadro(pdf, aviso, '#B71C1C');
    }

    this.seccion(pdf, 'Servicio');
    this.campos(pdf, [
      ['Modalidad', etiqueta('modalidad', historia.modalidad)],
      ['Estado', etiqueta('estado', historia.estado)],
      ['Abierta', fechaHora(historia.abiertaEn)],
      ['Cerrada', fechaHora(historia.cerradaEn)],
      ['Abierta por', historia.creadaPorNombre],
      ['Hora del evento', fechaHora(datos.horaEvento)],
    ]);

    this.seccion(pdf, 'Paciente');
    const nombre = [datos.nombres, datos.apellidos].filter(Boolean).join(' ');
    this.campos(pdf, [
      [
        'Nombre',
        datos.pacienteIdentificado ? nombre || null : 'NN (sin identificar)',
      ],
      [
        'Documento',
        datos.numeroDocumento
          ? `${datos.tipoDocumento ?? ''} ${datos.numeroDocumento}`.trim()
          : null,
      ],
      ['Sexo', etiqueta('sexo', datos.sexo)],
      ['Fecha de nacimiento', soloFecha(datos.fechaNacimiento)],
      ['Edad aproximada', datos.edadAproximada],
      ['EPS', datos.aseguradoraEps],
      ['Régimen', etiqueta('regimen', datos.regimenAfiliacion)],
      ['Acompañante', datos.acompananteNombre],
      ['Teléfono del acompañante', datos.acompananteTelefono],
    ]);

    this.seccion(pdf, 'Evento');
    this.campos(pdf, [
      ['Tipo de evento', etiqueta('tipoEvento', datos.tipoEvento)],
      ['Rol de la víctima', etiqueta('rolVictima', datos.rolVictima)],
      ['Elementos de protección', datos.elementosProteccion],
      ['Placa del vehículo', datos.placaVehiculo],
      ['Póliza SOAT', datos.polizaSoat],
    ]);
    this.texto(pdf, 'Mecanismo de la lesión', datos.mecanismoLesion);

    this.seccion(pdf, 'Valoración primaria (XABCDE) y antecedentes');
    this.campos(
      pdf,
      [
        ['X · Hemorragia masiva', datos.xHemorragiaMasiva],
        ['A · Vía aérea', datos.aViaAerea],
        ['B · Respiración', datos.bRespiracion],
        ['C · Circulación', datos.cCirculacion],
        ['D · Neurológico', datos.dNeurologico],
        ['E · Exposición', datos.eExposicion],
        ['Triage', etiqueta('triage', datos.triage)],
        ['Alergias', datos.alergias],
        ['Medicamentos habituales', datos.medicamentosHabituales],
        ['Antecedentes', datos.antecedentes],
      ],
      1,
    );

    this.seccion(pdf, 'Signos vitales');
    if (signosVitales.length === 0) {
      this.nota(pdf, 'No se registraron signos vitales.');
    } else {
      this.tabla(
        pdf,
        [
          'Hora',
          'TA',
          'FC',
          'FR',
          'SpO₂',
          'T °C',
          'Gluc.',
          'Glasgow',
          'Dolor',
        ].map((t) => t.replace('₂', '2')),
        signosVitales.map((s) => [
          formatoHora.format(s.medidoEn),
          s.presionSistolica !== null
            ? `${s.presionSistolica}/${s.presionDiastolica ?? '–'}`
            : '–',
          s.frecuenciaCardiaca ?? '–',
          s.frecuenciaRespiratoria ?? '–',
          s.saturacionOxigeno ?? '–',
          s.temperatura ?? '–',
          s.glucometria ?? '–',
          s.glasgowTotal !== null
            ? `${s.glasgowTotal} (O${s.glasgowOcular} V${s.glasgowVerbal} M${s.glasgowMotor})`
            : '–',
          s.escalaDolor ?? '–',
        ]),
        [50, 55, 35, 35, 40, 40, 40, 120, 40],
      );
    }

    this.seccion(pdf, 'Lesiones');
    if (lesiones.length === 0) this.nota(pdf, 'No se registraron lesiones.');
    for (const l of lesiones) {
      this.vineta(
        pdf,
        `${legible(l.regionCorporal)}: ${legible(l.tipoLesion)}${l.descripcion ? ` — ${l.descripcion}` : ''}`,
      );
    }

    this.seccion(pdf, 'Procedimientos y medicamentos');
    if (intervenciones.length === 0) {
      this.nota(pdf, 'No se registraron intervenciones.');
    }
    for (const i of intervenciones) {
      const partes = [
        i.realizadoEn ? formatoHora.format(i.realizadoEn) : null,
        etiqueta('tipoIntervencion', i.tipo),
        i.nombre,
        i.dosis,
        i.via,
        i.resultado ? `Resultado: ${i.resultado}` : null,
        i.registradoPorNombre ? `(${i.registradoPorNombre})` : null,
      ].filter(Boolean);
      this.vineta(pdf, partes.join(' · '));
    }

    if (d.detalle.valoracionesDownton.length > 0) {
      this.seccion(pdf, 'Riesgo de caídas (J.H. Downton)');
      for (const v of d.detalle.valoracionesDownton) {
        this.vineta(
          pdf,
          `${formatoHora.format(v.evaluadaEn)} · Puntaje ${v.puntajeTotal} · Riesgo ${etiqueta('nivelRiesgo', v.nivelRiesgo)} · Estado mental ${etiqueta('estadoMental', v.estadoMental)} · Deambulación ${etiqueta('deambulacion', v.deambulacion)}${v.observacion ? ` · ${v.observacion}` : ''}`,
        );
      }
    }

    this.seccion(pdf, 'Impresión diagnóstica y desenlace');
    this.texto(pdf, 'Impresión diagnóstica', datos.impresionDiagnostica);
    this.campos(pdf, [
      ['Desenlace', etiqueta('desenlace', datos.desenlace)],
      ['Institución de destino', historia.institucionDestinoNombre],
      ['Recibió', datos.receptorNombre],
      ['Cargo de quien recibió', datos.receptorCargo],
      ['Entregado', fechaHora(datos.entregadoEn)],
    ]);
    this.texto(pdf, 'Condición de entrega', datos.condicionEntrega);
    this.texto(pdf, 'Motivo del rechazo del traslado', datos.motivoRechazo);
    this.texto(pdf, 'Observaciones', datos.observaciones);

    this.seccion(pdf, 'Firmas');
    for (const { firma, imagen } of d.firmas) {
      const datosFirmante = [
        firma.nombreFirmante,
        firma.numeroDocumento
          ? `${firma.tipoDocumento ?? ''} ${firma.numeroDocumento}`.trim()
          : null,
        firma.parentesco ? etiqueta('parentesco', firma.parentesco) : null,
        firma.cargo,
      ].filter(Boolean);
      this.bloqueFirma(pdf, {
        titulo: `${etiqueta('rolFirmante', firma.rolFirmante)} · ${etiqueta('proposito', firma.proposito)}`,
        declaracion: d.textosFirma[firma.proposito] ?? null,
        imagen,
        lineas: [
          datosFirmante.join(' · ') || null,
          firma.motivoSinFirma
            ? `No firmó: ${etiqueta('motivoSinFirma', firma.motivoSinFirma)}${firma.detalleMotivo ? ` (${firma.detalleMotivo})` : ''}`
            : null,
          `Firmado: ${fechaHora(firma.firmadaEn)} · Tomada por ${firma.registradaPorNombre ?? SIN_DATO}`,
        ],
      });
    }
    if (d.firmaProfesional) {
      const f = d.firmaProfesional;
      this.bloqueFirma(pdf, {
        titulo: 'Profesional responsable · Firma electrónica',
        declaracion: d.declaracionProfesional,
        imagen: f.imagen,
        lineas: [
          `Firmado electrónicamente por: ${f.nombre ?? SIN_DATO}`,
          `Fecha y hora: ${fechaHora(f.firmadaEn)}`,
          'Método: reautenticación con credenciales personales',
          `Código de verificación: ${f.codigoVerificacion} (huella SHA-256 del contenido al firmar)`,
        ],
      });
    } else {
      this.nota(pdf, 'La historia aún no tiene la firma del profesional.');
    }
  }

  /** Pie de cada página: historia, estado, paginación y quién generó el documento. */
  private paginar(pdf: Documento, d: DocumentoHistoriaPdf): void {
    const { historia } = d.detalle;
    const generado = `Generado electrónicamente el ${formatoFechaHora.format(d.generadoEn)}${d.generadoPor ? ` por ${d.generadoPor}` : ''}`;
    const rango = pdf.bufferedPageRange();
    for (let i = rango.start; i < rango.start + rango.count; i++) {
      pdf.switchToPage(i);
      const margenInferior = pdf.page.margins.bottom;
      pdf.page.margins.bottom = 0;
      pdf
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(GRIS)
        .text(
          `${historia.numeroHistoria} · ${etiqueta('estado', historia.estado)} · Página ${i - rango.start + 1} de ${rango.count} · ${generado}`,
          MARGEN,
          pdf.page.height - 28,
          { width: ANCHO_UTIL, align: 'center' },
        );
      pdf.page.margins.bottom = margenInferior;
      pdf.fillColor('black');
    }
  }

  private asegurarEspacio(pdf: Documento, alto: number): void {
    if (pdf.y + alto > pdf.page.height - pdf.page.margins.bottom - 20) {
      pdf.addPage();
    }
  }

  private seccion(pdf: Documento, titulo: string): void {
    this.asegurarEspacio(pdf, 50);
    pdf.moveDown(0.6);
    const y = pdf.y;
    pdf.rect(MARGEN, y, ANCHO_UTIL, 18).fill('#E8EEF4');
    pdf
      .fillColor('#0D3B66')
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(titulo.toUpperCase(), MARGEN + 6, y + 5, {
        width: ANCHO_UTIL - 12,
      });
    pdf.fillColor('black');
    pdf.x = MARGEN;
    pdf.y = y + 24;
  }

  /** Pares etiqueta-valor en una o dos columnas; los vacíos dicen "Sin dato". */
  private campos(pdf: Documento, lista: Campo[], columnas: 1 | 2 = 2): void {
    const anchoColumna = ANCHO_UTIL / columnas;
    for (let i = 0; i < lista.length; i += columnas) {
      const fila = lista.slice(i, i + columnas);
      this.asegurarEspacio(pdf, 28);
      const y = pdf.y;
      let alto = 0;
      fila.forEach(([nombre, valor], j) => {
        const x = MARGEN + j * anchoColumna;
        pdf
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor(GRIS)
          .text(nombre, x, y, {
            width: anchoColumna - 10,
          });
        const vacio = valor === null || valor === undefined || valor === '';
        pdf
          .font(vacio ? 'Helvetica-Oblique' : 'Helvetica')
          .fontSize(9.5)
          .fillColor(vacio ? '#999999' : 'black')
          .text(vacio ? SIN_DATO : String(valor), x, y + 10, {
            width: anchoColumna - 10,
          });
        alto = Math.max(alto, pdf.y - y);
      });
      pdf.fillColor('black');
      pdf.x = MARGEN;
      pdf.y = y + alto + 4;
    }
  }

  /** Un texto largo con su etiqueta; no se imprime si está vacío. */
  private texto(pdf: Documento, nombre: string, valor: string | null): void {
    if (!valor) return;
    this.campos(pdf, [[nombre, valor]], 1);
  }

  private nota(pdf: Documento, texto: string): void {
    this.asegurarEspacio(pdf, 16);
    pdf
      .font('Helvetica-Oblique')
      .fontSize(8.5)
      .fillColor(GRIS)
      .text(texto, MARGEN, pdf.y, { width: ANCHO_UTIL });
    pdf.fillColor('black').moveDown(0.3);
  }

  private vineta(pdf: Documento, texto: string): void {
    this.asegurarEspacio(pdf, 16);
    pdf
      .font('Helvetica')
      .fontSize(9.5)
      .text(`•  ${texto}`, MARGEN + 4, pdf.y, { width: ANCHO_UTIL - 4 });
    pdf.moveDown(0.15);
  }

  private recuadro(pdf: Documento, texto: string, color: string): void {
    const y = pdf.y;
    pdf.rect(MARGEN, y, ANCHO_UTIL, 22).fill(color);
    pdf
      .fillColor('white')
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .text(texto, MARGEN + 8, y + 7, { width: ANCHO_UTIL - 16 });
    pdf.fillColor('black');
    pdf.x = MARGEN;
    pdf.y = y + 28;
  }

  private tabla(
    pdf: Documento,
    encabezados: string[],
    filas: (string | number)[][],
    anchos: number[],
  ): void {
    const fila = (celdas: (string | number)[], negrita: boolean) => {
      this.asegurarEspacio(pdf, 16);
      const y = pdf.y;
      let x = MARGEN;
      celdas.forEach((celda, i) => {
        pdf
          .font(negrita ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(8.5)
          .text(String(celda), x + 2, y, { width: (anchos[i] ?? 40) - 4 });
        x += anchos[i] ?? 40;
      });
      pdf.x = MARGEN;
      pdf.y = y + 14;
      pdf
        .moveTo(MARGEN, pdf.y - 2)
        .lineTo(MARGEN + ANCHO_UTIL, pdf.y - 2)
        .strokeColor('#DDDDDD')
        .stroke();
    };
    fila(encabezados, true);
    for (const f of filas) fila(f, false);
  }

  private bloqueFirma(
    pdf: Documento,
    bloque: {
      titulo: string;
      declaracion: string | null;
      imagen: Uint8Array | null;
      lineas: (string | null)[];
    },
  ): void {
    this.asegurarEspacio(pdf, 140);
    pdf.moveDown(0.4);
    pdf.font('Helvetica-Bold').fontSize(9.5).text(bloque.titulo, MARGEN, pdf.y);
    if (bloque.declaracion) {
      pdf
        .font('Helvetica-Oblique')
        .fontSize(8)
        .fillColor(GRIS)
        .text(`"${bloque.declaracion}"`, MARGEN, pdf.y + 2, {
          width: ANCHO_UTIL,
        });
      pdf.fillColor('black');
    }
    if (bloque.imagen) {
      const y = pdf.y + 4;
      pdf.image(Buffer.from(bloque.imagen), MARGEN, y, { fit: [200, 60] });
      pdf
        .moveTo(MARGEN, y + 62)
        .lineTo(MARGEN + 220, y + 62)
        .strokeColor('#999999')
        .stroke();
      pdf.y = y + 66;
    }
    for (const linea of bloque.lineas) {
      if (linea) {
        pdf.font('Helvetica').fontSize(8.5).text(linea, MARGEN, pdf.y, {
          width: ANCHO_UTIL,
        });
      }
    }
    pdf.moveDown(0.6);
  }
}
