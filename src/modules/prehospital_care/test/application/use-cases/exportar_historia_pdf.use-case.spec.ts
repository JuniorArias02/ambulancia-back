import {
  AuditoriaMemoria,
  UsuariosMemoria,
} from '../../../../../../test/dobles/repositorios_memoria.js';
import { AsignacionesMemoria } from '../../../../../../test/dobles/asignaciones_memoria.js';
import { AmbulanciasMemoria } from '../../../../../../test/dobles/ambulancias_memoria.js';
import { EmergenciasMemoria } from '../../../../../../test/dobles/emergencias_memoria.js';
import { TurnosMemoria } from '../../../../../../test/dobles/turnos_memoria.js';
import { Roles } from '../../../../../common/constants/roles.js';
import { RecursoNoEncontradoError } from '../../../../../common/exceptions/errores_dominio.js';
import { LectorImagenFirma } from '../../../../signatures/application/services/lector_imagen_firma.service.js';
import {
  AlmacenamientoFirmasMemoria,
  FirmasUsuariosMemoria,
} from '../../../../signatures/test/dobles/firmas_memoria.js';
import { AccesoHistoriaClinica } from '../../../application/services/acceso_historia_clinica.service.js';
import { ExportarHistoriaPdf } from '../../../application/use-cases/exportar_historia_pdf.use-case.js';
import { HistoriaClinica } from '../../../domain/entities/historia_clinica.entity.js';
import {
  type DocumentoHistoriaPdf,
  GeneradorPdfHistoria,
} from '../../../domain/services/generador_pdf_historia.js';
import { HistoriasClinicasMemoria } from '../../dobles/historias_memoria.js';

class GeneradorFalso extends GeneradorPdfHistoria {
  ultimo: DocumentoHistoriaPdf | null = null;
  generar(documento: DocumentoHistoriaPdf): Promise<Uint8Array> {
    this.ultimo = documento;
    return Promise.resolve(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
  }
}

const admin = {
  usuarioId: 'admin-1',
  direccionIp: null,
  rol: Roles.ADMINISTRADOR,
};

describe('ExportarHistoriaPdf', () => {
  let historias: HistoriasClinicasMemoria;
  let auditoria: AuditoriaMemoria;
  let generador: GeneradorFalso;
  let exportar: ExportarHistoriaPdf;

  beforeEach(() => {
    historias = new HistoriasClinicasMemoria();
    auditoria = new AuditoriaMemoria();
    generador = new GeneradorFalso();
    const acceso = new AccesoHistoriaClinica(
      historias,
      new AsignacionesMemoria(
        new AmbulanciasMemoria(),
        new EmergenciasMemoria(),
      ),
      new TurnosMemoria(),
    );
    exportar = new ExportarHistoriaPdf(
      historias,
      acceso,
      new FirmasUsuariosMemoria(),
      new LectorImagenFirma(new AlmacenamientoFirmasMemoria()),
      new UsuariosMemoria(),
      generador,
      auditoria,
    );
    const historia = HistoriaClinica.abrir({
      id: 'h1',
      numeroHistoria: 'HC-20261115-0001',
      emergenciaId: 'e1',
      asignacionId: 'a1',
      creadaPorId: 'p1',
      abiertaEn: new Date(),
      sincronizadaEn: new Date(),
    });
    historias.historias.set(historia.id, historia);
  });

  it('el administrador lo descarga con el nombre de la historia y queda auditado', async () => {
    const pdf = await exportar.ejecutar(
      'h1',
      { usuarioId: admin.usuarioId, rol: admin.rol },
      admin,
    );

    expect(pdf.nombreArchivo).toBe('HC-20261115-0001.pdf');
    expect(generador.ultimo?.firmaProfesional).toBeNull();
    expect(generador.ultimo?.textosFirma.disentimiento).toBeTruthy();
    expect(auditoria.eventos.at(-1)).toMatchObject({
      accion: 'exportar_pdf',
      entidadId: 'h1',
    });
  });

  it('un paramédico de otro servicio no puede; una historia inexistente da 404', async () => {
    await expect(
      exportar.ejecutar(
        'h1',
        { usuarioId: 'otro', rol: Roles.PARAMEDICO },
        admin,
      ),
    ).rejects.toThrow();
    // Sin ser de la tripulación del servicio no se genera nada.
    expect(generador.ultimo).toBeNull();
    await expect(
      exportar.ejecutar(
        'no-existe',
        { usuarioId: admin.usuarioId, rol: admin.rol },
        admin,
      ),
    ).rejects.toThrow(RecursoNoEncontradoError);
  });
});
