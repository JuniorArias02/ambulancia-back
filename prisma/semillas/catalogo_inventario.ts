/**
 * Catálogo base de inventario y perfiles de dotación para transporte
 * asistencial básico (TAB) y medicalizado (TAM).
 *
 * Referencias (Colombia):
 * - Resolución 3100 de 2019 (MinSalud), modificada por las Resoluciones 544
 *   de 2023 y 465 de 2025: estándares de dotación y de medicamentos,
 *   dispositivos médicos e insumos del servicio de transporte asistencial.
 * - Resolución 3316 de 2019: desfibriladores externos automáticos (DEA).
 * - Resolución 1478 de 2006 y normas del Fondo Nacional de Estupefacientes:
 *   medicamentos de control especial (morfina, fentanilo, midazolam…).
 *
 * Las cantidades son una base de trabajo, no la transcripción del anexo
 * técnico: cada prestador debe ajustarlas a su habilitación desde la web.
 */

type TipoInsumo =
  | 'medicamento'
  | 'dispositivo_medico'
  | 'insumo_asistencial'
  | 'equipo_biomedico'
  | 'oxigeno_medicinal'
  | 'otro';

export interface InsumoSemilla {
  codigo: string;
  nombre: string;
  tipo: TipoInsumo;
  categoria: string;
  unidadMedida: string;
  /** Cómo se controla: serie (equipo), lote (con vencimiento) o solo cantidad. */
  control: 'serie' | 'lote' | 'cantidad';
  requiereRegistroSanitario: boolean;
  esControlEspecial?: boolean;
  /** Mínimo esperado en bodegas (alerta). */
  stockMinimo: number;
}

const medicamento = (
  codigo: string,
  nombre: string,
  categoria: string,
  unidadMedida: string,
  stockMinimo: number,
  esControlEspecial = false,
): InsumoSemilla => ({
  codigo,
  nombre,
  tipo: 'medicamento',
  categoria,
  unidadMedida,
  control: 'lote',
  requiereRegistroSanitario: true,
  esControlEspecial,
  stockMinimo,
});

const dispositivo = (
  codigo: string,
  nombre: string,
  categoria: string,
  unidadMedida: string,
  stockMinimo: number,
  control: 'lote' | 'cantidad' = 'lote',
): InsumoSemilla => ({
  codigo,
  nombre,
  tipo: 'dispositivo_medico',
  categoria,
  unidadMedida,
  control,
  requiereRegistroSanitario: true,
  stockMinimo,
});

const asistencial = (
  codigo: string,
  nombre: string,
  unidadMedida: string,
  stockMinimo: number,
  control: 'lote' | 'cantidad',
): InsumoSemilla => ({
  codigo,
  nombre,
  tipo: 'insumo_asistencial',
  categoria: 'Insumos de atención',
  unidadMedida,
  control,
  requiereRegistroSanitario: control === 'lote',
  stockMinimo,
});

const equipo = (
  codigo: string,
  nombre: string,
  categoria: string,
): InsumoSemilla => ({
  codigo,
  nombre,
  tipo: 'equipo_biomedico',
  categoria,
  unidadMedida: 'unidad',
  control: 'serie',
  requiereRegistroSanitario: true,
  stockMinimo: 0,
});

export const INSUMOS_BASE: InsumoSemilla[] = [
  // Soluciones
  medicamento(
    'SOL-001',
    'Cloruro de sodio 0,9 % x 500 ml',
    'Soluciones',
    'bolsa',
    60,
  ),
  medicamento(
    'SOL-002',
    'Lactato de Ringer x 500 ml',
    'Soluciones',
    'bolsa',
    40,
  ),
  medicamento(
    'SOL-003',
    'Dextrosa 5 % en agua x 500 ml',
    'Soluciones',
    'bolsa',
    20,
  ),
  medicamento(
    'SOL-004',
    'Dextrosa 10 % en agua x 500 ml',
    'Soluciones',
    'bolsa',
    10,
  ),
  // Reanimación y cardiovasculares
  medicamento(
    'MED-001',
    'Adrenalina (epinefrina) 1 mg/ml ampolla',
    'Reanimación',
    'ampolla',
    40,
  ),
  medicamento(
    'MED-002',
    'Atropina 1 mg/ml ampolla',
    'Reanimación',
    'ampolla',
    20,
  ),
  medicamento(
    'MED-003',
    'Amiodarona 150 mg/3 ml ampolla',
    'Antiarrítmicos',
    'ampolla',
    12,
  ),
  medicamento(
    'MED-004',
    'Adenosina 6 mg/2 ml ampolla',
    'Antiarrítmicos',
    'ampolla',
    12,
  ),
  medicamento(
    'MED-005',
    'Bicarbonato de sodio 1 mEq/ml x 10 ml ampolla',
    'Reanimación',
    'ampolla',
    10,
  ),
  medicamento(
    'MED-006',
    'Gluconato de calcio 10 % x 10 ml ampolla',
    'Electrolitos',
    'ampolla',
    10,
  ),
  medicamento(
    'MED-007',
    'Sulfato de magnesio 20 % x 10 ml ampolla',
    'Electrolitos',
    'ampolla',
    10,
  ),
  medicamento(
    'MED-008',
    'Dopamina 200 mg/5 ml ampolla',
    'Vasoactivos',
    'ampolla',
    6,
  ),
  medicamento(
    'MED-009',
    'Norepinefrina 4 mg/4 ml ampolla',
    'Vasoactivos',
    'ampolla',
    6,
  ),
  medicamento(
    'MED-010',
    'Dobutamina 250 mg/20 ml ampolla',
    'Vasoactivos',
    'ampolla',
    6,
  ),
  medicamento(
    'MED-011',
    'Dinitrato de isosorbida 5 mg tableta sublingual',
    'Cardiovasculares',
    'tableta',
    20,
  ),
  medicamento(
    'MED-012',
    'Furosemida 20 mg/2 ml ampolla',
    'Cardiovasculares',
    'ampolla',
    10,
  ),
  medicamento(
    'MED-013',
    'Heparina sódica 5.000 UI/ml vial',
    'Anticoagulantes',
    'vial',
    6,
  ),
  // Antiinflamatorios, antieméticos y otros
  medicamento(
    'MED-014',
    'Dexametasona 8 mg/2 ml ampolla',
    'Corticoides',
    'ampolla',
    12,
  ),
  medicamento(
    'MED-015',
    'Hidrocortisona 100 mg vial',
    'Corticoides',
    'vial',
    10,
  ),
  medicamento(
    'MED-016',
    'Metilprednisolona 500 mg vial',
    'Corticoides',
    'vial',
    6,
  ),
  medicamento(
    'MED-017',
    'Metoclopramida 10 mg/2 ml ampolla',
    'Antieméticos',
    'ampolla',
    10,
  ),
  medicamento(
    'MED-018',
    'Hioscina N-butilbromuro 20 mg/ml ampolla',
    'Antiespasmódicos',
    'ampolla',
    10,
  ),
  medicamento(
    'MED-019',
    'Fenitoína sódica 250 mg/5 ml ampolla',
    'Anticonvulsivantes',
    'ampolla',
    6,
  ),
  medicamento(
    'MED-020',
    'Haloperidol 5 mg/ml ampolla',
    'Antipsicóticos',
    'ampolla',
    6,
  ),
  medicamento(
    'MED-021',
    'Lidocaína 2 % jalea x 30 g',
    'Anestésicos locales',
    'tubo',
    6,
  ),
  // Control especial (Fondo Nacional de Estupefacientes)
  medicamento(
    'MCE-001',
    'Morfina 10 mg/ml ampolla',
    'Control especial',
    'ampolla',
    10,
    true,
  ),
  medicamento(
    'MCE-002',
    'Fentanilo 0,5 mg/10 ml ampolla',
    'Control especial',
    'ampolla',
    6,
    true,
  ),
  medicamento(
    'MCE-003',
    'Midazolam 15 mg/3 ml ampolla',
    'Control especial',
    'ampolla',
    6,
    true,
  ),
  medicamento(
    'MCE-004',
    'Diazepam 10 mg/2 ml ampolla',
    'Control especial',
    'ampolla',
    6,
    true,
  ),
  // Oxígeno medicinal
  {
    codigo: 'OXI-001',
    nombre: 'Oxígeno medicinal, cilindro portátil 0,68 m³',
    tipo: 'oxigeno_medicinal',
    categoria: 'Gases medicinales',
    unidadMedida: 'cilindro',
    control: 'lote',
    requiereRegistroSanitario: true,
    stockMinimo: 4,
  },
  {
    codigo: 'OXI-002',
    nombre: 'Oxígeno medicinal, cilindro fijo 3 m³',
    tipo: 'oxigeno_medicinal',
    categoria: 'Gases medicinales',
    unidadMedida: 'cilindro',
    control: 'lote',
    requiereRegistroSanitario: true,
    stockMinimo: 4,
  },
  // Dispositivos: acceso vascular
  dispositivo(
    'DM-001',
    'Catéter intravenoso periférico N.º 18',
    'Acceso vascular',
    'unidad',
    30,
  ),
  dispositivo(
    'DM-002',
    'Catéter intravenoso periférico N.º 20',
    'Acceso vascular',
    'unidad',
    30,
  ),
  dispositivo(
    'DM-003',
    'Catéter intravenoso periférico N.º 22',
    'Acceso vascular',
    'unidad',
    30,
  ),
  dispositivo(
    'DM-004',
    'Equipo de venoclisis macrogoteo',
    'Acceso vascular',
    'unidad',
    30,
  ),
  dispositivo(
    'DM-005',
    'Equipo de venoclisis microgoteo',
    'Acceso vascular',
    'unidad',
    15,
  ),
  // Dispositivos: vía aérea y oxigenoterapia
  dispositivo(
    'DM-006',
    'Cánula nasal para oxígeno adulto',
    'Oxigenoterapia',
    'unidad',
    30,
  ),
  dispositivo(
    'DM-007',
    'Cánula nasal para oxígeno pediátrica',
    'Oxigenoterapia',
    'unidad',
    15,
  ),
  dispositivo(
    'DM-008',
    'Máscara de no reinhalación con reservorio adulto',
    'Oxigenoterapia',
    'unidad',
    20,
  ),
  dispositivo(
    'DM-009',
    'Máscara de no reinhalación con reservorio pediátrica',
    'Oxigenoterapia',
    'unidad',
    10,
  ),
  dispositivo(
    'DM-010',
    'Sistema Venturi adulto',
    'Oxigenoterapia',
    'unidad',
    10,
  ),
  dispositivo(
    'DM-011',
    'Kit de nebulización adulto',
    'Oxigenoterapia',
    'unidad',
    10,
  ),
  dispositivo(
    'DM-012',
    'Juego de cánulas orofaríngeas (Guedel)',
    'Vía aérea',
    'juego',
    4,
  ),
  dispositivo(
    'DM-013',
    'Resucitador manual (bolsa-válvula-máscara) adulto',
    'Vía aérea',
    'unidad',
    2,
    'cantidad',
  ),
  dispositivo(
    'DM-014',
    'Resucitador manual (bolsa-válvula-máscara) pediátrico',
    'Vía aérea',
    'unidad',
    2,
    'cantidad',
  ),
  dispositivo(
    'DM-015',
    'Tubo endotraqueal con balón N.º 7,0',
    'Vía aérea',
    'unidad',
    6,
  ),
  dispositivo(
    'DM-016',
    'Tubo endotraqueal con balón N.º 7,5',
    'Vía aérea',
    'unidad',
    6,
  ),
  dispositivo('DM-017', 'Sonda nasogástrica N.º 16', 'Sondas', 'unidad', 6),
  dispositivo('DM-018', 'Sonda vesical Foley N.º 16', 'Sondas', 'unidad', 6),
  dispositivo(
    'DM-019',
    'Kit estéril de atención de parto',
    'Obstetricia',
    'kit',
    4,
  ),
  // Dispositivos: inmovilización (reutilizables, sin lote)
  dispositivo(
    'DM-020',
    'Collar cervical graduable adulto',
    'Inmovilización',
    'unidad',
    4,
    'cantidad',
  ),
  dispositivo(
    'DM-021',
    'Inmovilizador lateral de cabeza',
    'Inmovilización',
    'juego',
    2,
    'cantidad',
  ),
  dispositivo(
    'DM-022',
    'Tabla espinal larga',
    'Inmovilización',
    'unidad',
    1,
    'cantidad',
  ),
  dispositivo(
    'DM-023',
    'Camilla tipo cuchara (scoop)',
    'Inmovilización',
    'unidad',
    1,
    'cantidad',
  ),
  dispositivo(
    'DM-024',
    'Fonendoscopio adulto',
    'Diagnóstico',
    'unidad',
    2,
    'cantidad',
  ),
  // Insumos de atención
  asistencial(
    'INS-001',
    'Gasa estéril 7,5 x 7,5 cm (sobre)',
    'sobre',
    200,
    'lote',
  ),
  asistencial(
    'INS-002',
    'Guantes de examen no estériles (caja x 100)',
    'caja',
    10,
    'cantidad',
  ),
  asistencial(
    'INS-003',
    'Guantes quirúrgicos estériles N.º 7,5',
    'par',
    30,
    'lote',
  ),
  asistencial('INS-004', 'Jeringa desechable 5 ml', 'unidad', 60, 'lote'),
  asistencial('INS-005', 'Jeringa desechable 10 ml', 'unidad', 60, 'lote'),
  asistencial('INS-006', 'Esparadrapo microporoso 1"', 'rollo', 10, 'cantidad'),
  asistencial('INS-007', 'Venda elástica 4"', 'unidad', 30, 'cantidad'),
  asistencial(
    'INS-008',
    'Alcohol antiséptico 70 % x 120 ml',
    'frasco',
    6,
    'lote',
  ),
  asistencial(
    'INS-009',
    'Jabón quirúrgico (clorhexidina 4 %) x 120 ml',
    'frasco',
    6,
    'lote',
  ),
  asistencial('INS-010', 'Algodón x 50 g', 'rollo', 6, 'cantidad'),
  asistencial(
    'INS-011',
    'Sábana desechable para camilla',
    'unidad',
    40,
    'cantidad',
  ),
  asistencial(
    'INS-012',
    'Bolsa roja para residuos biosanitarios',
    'unidad',
    30,
    'cantidad',
  ),
  asistencial(
    'INS-013',
    'Guardián para cortopunzantes 1,5 l',
    'unidad',
    6,
    'cantidad',
  ),
  asistencial('INS-014', 'Respirador N95', 'unidad', 60, 'cantidad'),
  asistencial(
    'INS-015',
    'Manta térmica de emergencia',
    'unidad',
    10,
    'cantidad',
  ),
  // Equipos biomédicos (por número de serie)
  equipo('EQ-001', 'Desfibrilador externo automático (DEA)', 'Soporte vital'),
  equipo(
    'EQ-002',
    'Monitor de signos vitales con desfibrilador',
    'Soporte vital',
  ),
  equipo('EQ-003', 'Ventilador de transporte', 'Soporte ventilatorio'),
  equipo('EQ-004', 'Aspirador de secreciones portátil', 'Soporte ventilatorio'),
  equipo('EQ-005', 'Oxímetro de pulso portátil', 'Monitoreo'),
  equipo('EQ-006', 'Glucómetro', 'Monitoreo'),
  equipo('EQ-007', 'Bomba de infusión', 'Infusión'),
  equipo('EQ-008', 'Tensiómetro adulto', 'Monitoreo'),
  equipo('EQ-009', 'Laringoscopio con hojas adulto y pediátricas', 'Vía aérea'),
  equipo('EQ-010', 'Termómetro digital', 'Monitoreo'),
];

/** [código del insumo, cantidad requerida, cantidad mínima] */
type ElementoPerfil = [string, number, number];

export interface PerfilSemilla {
  /** Nombre del tipo de ambulancia (tabla `tipos_ambulancia`). */
  tipoAmbulancia: 'TAB' | 'TAM';
  codigo: string;
  nombre: string;
  descripcion: string;
  elementos: ElementoPerfil[];
}

/** Lo que llevan ambas: oxigenoterapia, acceso vascular, inmovilización e insumos. */
const COMUN: ElementoPerfil[] = [
  ['OXI-001', 2, 1],
  ['OXI-002', 2, 1],
  ['SOL-001', 6, 3],
  ['SOL-002', 4, 2],
  ['SOL-003', 2, 1],
  ['DM-001', 4, 2],
  ['DM-002', 4, 2],
  ['DM-003', 4, 2],
  ['DM-004', 4, 2],
  ['DM-005', 2, 1],
  ['DM-006', 5, 2],
  ['DM-007', 3, 1],
  ['DM-008', 3, 1],
  ['DM-009', 2, 1],
  ['DM-010', 2, 1],
  ['DM-011', 2, 1],
  ['DM-012', 1, 1],
  ['DM-013', 1, 1],
  ['DM-014', 1, 1],
  ['DM-019', 1, 1],
  ['DM-020', 2, 1],
  ['DM-021', 1, 1],
  ['DM-022', 1, 1],
  ['DM-023', 1, 1],
  ['DM-024', 1, 1],
  ['INS-001', 50, 20],
  ['INS-002', 2, 1],
  ['INS-003', 5, 2],
  ['INS-004', 10, 5],
  ['INS-005', 10, 5],
  ['INS-006', 2, 1],
  ['INS-007', 6, 3],
  ['INS-008', 1, 1],
  ['INS-009', 1, 1],
  ['INS-010', 1, 1],
  ['INS-011', 6, 3],
  ['INS-012', 5, 2],
  ['INS-013', 1, 1],
  ['INS-014', 6, 3],
  ['INS-015', 2, 1],
  ['EQ-004', 1, 1],
  ['EQ-005', 1, 1],
  ['EQ-006', 1, 1],
  ['EQ-008', 1, 1],
  ['EQ-010', 1, 1],
];

export const PERFILES_BASE: PerfilSemilla[] = [
  {
    tipoAmbulancia: 'TAB',
    codigo: 'DOT-TAB',
    nombre: 'Dotación transporte asistencial básico',
    descripcion:
      'Base de trabajo según la Resolución 3100 de 2019 (servicio de transporte asistencial básico) y la Resolución 3316 de 2019 (DEA). Ajústela a la habilitación del prestador.',
    elementos: [...COMUN, ['EQ-001', 1, 1]],
  },
  {
    tipoAmbulancia: 'TAM',
    codigo: 'DOT-TAM',
    nombre: 'Dotación transporte asistencial medicalizado',
    descripcion:
      'Básica más soporte avanzado: monitor con desfibrilador, ventilador de transporte, laringoscopio, bomba de infusión y medicamentos (Resolución 3100 de 2019). Ajústela a la habilitación del prestador.',
    elementos: [
      ...COMUN,
      ['SOL-004', 2, 1],
      ['EQ-002', 1, 1],
      ['EQ-003', 1, 1],
      ['EQ-007', 1, 1],
      ['EQ-009', 1, 1],
      ['DM-015', 2, 1],
      ['DM-016', 2, 1],
      ['DM-017', 2, 1],
      ['DM-018', 2, 1],
      ['MED-001', 10, 5],
      ['MED-002', 5, 3],
      ['MED-003', 3, 2],
      ['MED-004', 3, 2],
      ['MED-005', 2, 1],
      ['MED-006', 2, 1],
      ['MED-007', 2, 1],
      ['MED-008', 1, 1],
      ['MED-009', 1, 1],
      ['MED-010', 1, 1],
      ['MED-011', 4, 2],
      ['MED-012', 2, 1],
      ['MED-013', 1, 1],
      ['MED-014', 2, 1],
      ['MED-015', 2, 1],
      ['MED-016', 1, 1],
      ['MED-017', 2, 1],
      ['MED-018', 2, 1],
      ['MED-019', 1, 1],
      ['MED-020', 1, 1],
      ['MED-021', 1, 1],
      ['MCE-001', 2, 1],
      ['MCE-002', 1, 1],
      ['MCE-003', 1, 1],
      ['MCE-004', 1, 1],
    ],
  },
];
