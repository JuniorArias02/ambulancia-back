import { HuellaHistoria } from '../../../application/services/huella_historia.service.js';
import { HistoriaClinica } from '../../../domain/entities/historia_clinica.entity.js';
import type { Lesion } from '../../../domain/entities/registros_clinicos.js';
import { crearValoracionDownton } from '../../../domain/entities/valoracion_downton.entity.js';

describe('HuellaHistoria', () => {
  const huella = new HuellaHistoria();
  const historia = HistoriaClinica.abrir({
    id: 'h1',
    numeroHistoria: 'HC-20261025-0001',
    emergenciaId: 'e1',
    asignacionId: 'a1',
    creadaPorId: 'p1',
    abiertaEn: new Date('2026-10-25T15:00:00Z'),
    sincronizadaEn: new Date('2026-10-25T15:00:00Z'),
  });
  const l1: Lesion = {
    id: 'l1',
    historiaClinicaId: 'h1',
    regionCorporal: 'cabeza',
    tipoLesion: 'herida',
    descripcion: null,
  };
  const l2: Lesion = {
    id: 'l2',
    historiaClinicaId: 'h1',
    regionCorporal: 'torax',
    tipoLesion: 'contusion',
    descripcion: null,
  };

  it('el mismo contenido da la misma huella, sin importar el orden de los registros', () => {
    const a = huella.calcular({
      historia,
      signosVitales: [],
      lesiones: [l1, l2],
      intervenciones: [],
      valoracionesDownton: [],
      firmasHistoria: [],
    });
    const b = huella.calcular({
      historia,
      signosVitales: [],
      lesiones: [l2, l1],
      intervenciones: [],
      valoracionesDownton: [],
      firmasHistoria: [],
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('cualquier cambio en el contenido cambia la huella', () => {
    const antes = huella.calcular({
      historia,
      signosVitales: [],
      lesiones: [l1],
      intervenciones: [],
      valoracionesDownton: [],
      firmasHistoria: [],
    });
    const despues = huella.calcular({
      historia,
      signosVitales: [],
      lesiones: [{ ...l1, descripcion: 'cambiada' }],
      intervenciones: [],
      valoracionesDownton: [],
      firmasHistoria: [],
    });
    expect(antes).not.toBe(despues);
  });

  it('una valoración Downton entra en la huella', () => {
    const ahora = new Date('2026-10-25T15:10:00Z');
    const valoracion = crearValoracionDownton({
      id: 'v1',
      historiaClinicaId: 'h1',
      evaluadaEn: ahora,
      respuestas: {
        caidasPrevias: true,
        medTranquilizantesSedantes: false,
        medDiureticos: false,
        medHipotensores: false,
        medAntiparkinsonianos: false,
        medAntidepresivos: false,
        medOtros: false,
        deficitVisual: false,
        deficitAuditivo: false,
        deficitExtremidades: false,
        estadoMental: 'orientado',
        deambulacion: 'normal',
      },
      origen: 'manual',
      registradoPorId: 'p1',
      ahora,
    });
    const base = {
      historia,
      signosVitales: [],
      lesiones: [l1],
      intervenciones: [],
      firmasHistoria: [],
    };

    const sin = huella.calcular({ ...base, valoracionesDownton: [] });
    const con = huella.calcular({ ...base, valoracionesDownton: [valoracion] });
    const conNombre = huella.calcular({
      ...base,
      valoracionesDownton: [{ ...valoracion, registradoPorNombre: 'Lucía' }],
    });

    expect(con).not.toBe(sin);
    expect(conNombre).toBe(con);
  });
});
