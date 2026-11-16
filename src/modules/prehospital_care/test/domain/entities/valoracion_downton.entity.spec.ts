import { ReglaNegocioError } from '../../../../../common/exceptions/errores_dominio.js';
import {
  calcularPuntajeDownton,
  crearValoracionDownton,
  PUNTAJE_MAXIMO_DOWNTON,
  type RespuestasDownton,
} from '../../../domain/entities/valoracion_downton.entity.js';

const SIN_RIESGO: RespuestasDownton = {
  caidasPrevias: false,
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
};

const ahora = new Date('2026-11-13T15:00:00Z');

function crear(
  extra: Partial<Parameters<typeof crearValoracionDownton>[0]> = {},
) {
  return crearValoracionDownton({
    id: 'v1',
    historiaClinicaId: 'h1',
    evaluadaEn: ahora,
    respuestas: SIN_RIESGO,
    origen: 'manual',
    registradoPorId: 'p1',
    ahora,
    ...extra,
  });
}

describe('Escala de riesgo de caídas J.H. Downton', () => {
  it('sin ningún ítem marcado: 0 puntos, riesgo bajo', () => {
    expect(calcularPuntajeDownton(SIN_RIESGO)).toEqual({
      puntajeTotal: 0,
      nivelRiesgo: 'bajo',
    });
  });

  it('suma un punto por caída previa, por cada medicamento y por cada déficit', () => {
    expect(
      calcularPuntajeDownton({
        ...SIN_RIESGO,
        caidasPrevias: true,
        medDiureticos: true,
        medAntidepresivos: true,
        deficitVisual: true,
      }).puntajeTotal,
    ).toBe(4);
  });

  it('estado mental confuso suma 1; orientado, 0', () => {
    expect(
      calcularPuntajeDownton({ ...SIN_RIESGO, estadoMental: 'confuso' })
        .puntajeTotal,
    ).toBe(1);
  });

  it.each([
    ['normal', 0],
    ['segura_con_ayuda', 0],
    ['insegura', 1],
    ['imposible', 1],
  ] as const)('deambulación %s suma %i', (deambulacion, puntos) => {
    expect(
      calcularPuntajeDownton({ ...SIN_RIESGO, deambulacion }).puntajeTotal,
    ).toBe(puntos);
  });

  it('2 puntos es riesgo bajo; 3 puntos ya es riesgo alto', () => {
    const dos = { ...SIN_RIESGO, caidasPrevias: true, medOtros: true };
    expect(calcularPuntajeDownton(dos).nivelRiesgo).toBe('bajo');
    expect(calcularPuntajeDownton({ ...dos, estadoMental: 'confuso' })).toEqual(
      { puntajeTotal: 3, nivelRiesgo: 'alto' },
    );
  });

  it('todo marcado da el máximo: 12 puntos', () => {
    const todo: RespuestasDownton = {
      caidasPrevias: true,
      medTranquilizantesSedantes: true,
      medDiureticos: true,
      medHipotensores: true,
      medAntiparkinsonianos: true,
      medAntidepresivos: true,
      medOtros: true,
      deficitVisual: true,
      deficitAuditivo: true,
      deficitExtremidades: true,
      estadoMental: 'confuso',
      deambulacion: 'imposible',
    };
    expect(PUNTAJE_MAXIMO_DOWNTON).toBe(12);
    expect(calcularPuntajeDownton(todo)).toEqual({
      puntajeTotal: 12,
      nivelRiesgo: 'alto',
    });
  });

  it('al crear guarda el puntaje calculado, confirmada y la observación sin espacios', () => {
    const valoracion = crear({
      respuestas: { ...SIN_RIESGO, deambulacion: 'imposible' },
      observacion: '   ',
    });
    expect(valoracion).toMatchObject({
      puntajeTotal: 1,
      nivelRiesgo: 'bajo',
      confirmado: true,
      origen: 'manual',
      segmentoAudioId: null,
      observacion: null,
    });
  });

  it('no acepta una fecha en el futuro (tolera 60 s de diferencia de reloj)', () => {
    expect(() =>
      crear({ evaluadaEn: new Date(ahora.getTime() + 30_000) }),
    ).not.toThrow();
    expect(() =>
      crear({ evaluadaEn: new Date(ahora.getTime() + 5 * 60_000) }),
    ).toThrow(ReglaNegocioError);
  });

  it('origen voz exige segmento de audio, y uno manual no lo admite', () => {
    expect(() => crear({ origen: 'voz' })).toThrow(/segmento de audio/);
    expect(() => crear({ segmentoAudioId: 's1' })).toThrow(ReglaNegocioError);
    expect(crear({ origen: 'voz', segmentoAudioId: 's1' })).toMatchObject({
      origen: 'voz',
      segmentoAudioId: 's1',
      confirmado: true,
    });
  });
});
