/**
 * Los servicios de demostración: cubren las 5 modalidades, los 4 desenlaces y
 * los casos de firma (paciente, acudiente, testigo, receptor, sin firma).
 *
 * Todos los datos son ficticios: los documentos de los pacientes están en el
 * rango 99000000xx y los teléfonos en 30000000xx.
 */
import type { RegistrarEmergenciaEntrada } from '../../../src/modules/emergencies/application/use-cases/registrar_emergencia.use-case.js';
import type { RegistrarFirmaHistoriaEntrada } from '../../../src/modules/prehospital_care/application/use-cases/registrar_firma_historia.use-case.js';
import type {
  RegionCorporal,
  TipoIntervencion,
  TipoLesion,
} from '../../../src/modules/prehospital_care/domain/catalogos_clinicos.js';
import type { DatosEditablesHistoria } from '../../../src/modules/prehospital_care/domain/entities/historia_clinica.entity.js';
import type { MedicionesSignoVital } from '../../../src/modules/prehospital_care/domain/entities/registros_clinicos.js';
import type { RespuestasDownton } from '../../../src/modules/prehospital_care/domain/entities/valoracion_downton.entity.js';

export type TipoAmbulanciaDemo = 'TAB' | 'TAM';
export type InstitucionDemo = 'norte' | 'central';

/** Hasta dónde llega el servicio. */
export type AlcanceServicio =
  /** Llamada recibida, sin despachar. */
  | 'recibida'
  /** Despachada y cancelada antes de llegar; luego se cancela la emergencia. */
  | 'cancelada'
  /** En escena con la historia abierta: un servicio en curso. */
  | 'en_curso'
  /** Historia cerrada y firmada. */
  | 'completo';

/** Una firma de la historia; la imagen se dibuja con el nombre de quien firma. */
export type FirmaDemo = Omit<
  RegistrarFirmaHistoriaEntrada,
  'id' | 'imagen' | 'firmadaEn'
>;

export interface HistoriaDemo {
  /** Identidad del paciente: va al abrir la historia. */
  paciente: DatosEditablesHistoria;
  /** Valoración, antecedentes y desenlace (sin destino ni receptor). */
  clinica: DatosEditablesHistoria;
  signos: Partial<MedicionesSignoVital>[];
  lesiones?: {
    regionCorporal: RegionCorporal;
    tipoLesion: TipoLesion;
    descripcion?: string;
  }[];
  intervenciones?: {
    tipo: TipoIntervencion;
    nombre: string;
    dosis?: string;
    via?: string;
    resultado?: string;
  }[];
  downton?: RespuestasDownton;
  /** Solo si fue trasladado. */
  entrega?: {
    institucion: InstitucionDemo;
    condicionEntrega: string;
    receptorNombre: string;
    receptorCargo: string;
  };
  /** Obligatoria al cerrar sin traslado (`en_escena` → `finalizada`). */
  observacionCierreServicio?: string;
  firmas: FirmaDemo[];
}

export interface EscenarioDemo {
  /** Va al inicio de la descripción: `[DEMO-01]`. Sirve para no repetirlo. */
  codigo: string;
  /** Cuándo entra la llamada (hora de Colombia). `null` en `haceDias`: hace `minutosAtras` minutos. */
  haceDias: number | null;
  hora?: string;
  minutosAtras?: number;
  ambulancia: TipoAmbulanciaDemo;
  alcance: AlcanceServicio;
  emergencia: Omit<RegistrarEmergenciaEntrada, 'descripcion'> & {
    descripcion: string;
    latitud: number;
    longitud: number;
  };
  historia?: HistoriaDemo;
  motivoCancelacion?: string;
}

const SIN_MEDICAMENTOS_DOWNTON = {
  medTranquilizantesSedantes: false,
  medDiureticos: false,
  medHipotensores: false,
  medAntiparkinsonianos: false,
  medAntidepresivos: false,
  medOtros: false,
} as const;

export const ESCENARIOS: readonly EscenarioDemo[] = [
  {
    codigo: 'DEMO-01',
    haceDias: 28,
    hora: '03:12',
    ambulancia: 'TAB',
    alcance: 'completo',
    emergencia: {
      fuente: 'linea_123',
      modalidad: 'emergencia',
      tipoIncidente: 'clinico',
      prioridad: 'roja',
      descripcion: 'Hombre de 58 años con dolor en el pecho desde hace 30 min',
      informanteNombre: 'Gloria Peña',
      informanteTelefono: '3000000001',
      direccion: 'Calle 10 # 4-25, barrio La Playa',
      referenciaLugar: 'Casa esquinera de rejas blancas',
      latitud: 7.8891,
      longitud: -72.5012,
      numeroVictimas: 1,
    },
    historia: {
      paciente: {
        pacienteIdentificado: true,
        nombres: 'Carlos Andrés',
        apellidos: 'Ramírez Peña',
        tipoDocumento: 'CC',
        numeroDocumento: '9900000001',
        sexo: 'masculino',
        edadAproximada: 58,
        fechaNacimiento: new Date('1968-04-12T00:00:00.000Z'),
        aseguradoraEps: 'EPS Demo Salud',
        regimenAfiliacion: 'contributivo',
        acompananteNombre: 'Gloria Peña',
        acompananteTelefono: '3000000001',
      },
      clinica: {
        tipoEvento: 'clinico',
        aViaAerea: 'Permeable',
        bRespiracion: 'Taquipneico, sin tirajes',
        cCirculacion: 'Pálido, diaforético, pulsos presentes',
        dNeurologico: 'Alerta, orientado',
        eExposicion: 'Sin lesiones visibles',
        triage: 'amarillo',
        alergias: 'Niega',
        medicamentosHabituales: 'Losartán 50 mg cada 12 h',
        antecedentes: 'Hipertensión arterial',
        impresionDiagnostica: 'Síndrome coronario agudo a descartar',
        desenlace: 'trasladado',
      },
      signos: [
        {
          presionSistolica: 165,
          presionDiastolica: 98,
          frecuenciaCardiaca: 108,
          frecuenciaRespiratoria: 24,
          saturacionOxigeno: 91,
          temperatura: 36.6,
          glasgowOcular: 4,
          glasgowVerbal: 5,
          glasgowMotor: 6,
          escalaDolor: 8,
        },
        {
          presionSistolica: 150,
          presionDiastolica: 92,
          frecuenciaCardiaca: 96,
          frecuenciaRespiratoria: 20,
          saturacionOxigeno: 95,
          escalaDolor: 6,
        },
      ],
      intervenciones: [
        {
          tipo: 'procedimiento',
          nombre: 'Oxígeno por cánula nasal',
          dosis: '3 L/min',
          resultado: 'Mejora la saturación a 95 %',
        },
        {
          tipo: 'medicamento',
          nombre: 'Ácido acetilsalicílico',
          dosis: '300 mg',
          via: 'oral',
        },
      ],
      entrega: {
        institucion: 'norte',
        condicionEntrega: 'Estable, consciente, dolor 6/10',
        receptorNombre: 'Paola Suárez Mejía',
        receptorCargo: 'Médica de urgencias',
      },
      firmas: [
        { rolFirmante: 'paciente', proposito: 'comprobante_atencion' },
        {
          rolFirmante: 'receptor',
          proposito: 'entrega',
          nombreFirmante: 'Paola Suárez Mejía',
          cargo: 'Médica de urgencias',
        },
      ],
    },
  },
  {
    codigo: 'DEMO-02',
    haceDias: 26,
    hora: '14:40',
    ambulancia: 'TAM',
    alcance: 'completo',
    emergencia: {
      fuente: 'telefono',
      modalidad: 'emergencia',
      tipoIncidente: 'caida',
      prioridad: 'amarilla',
      descripcion: 'Adulta mayor se cayó en el baño, dolor en la cadera',
      informanteNombre: 'Diana Torres',
      informanteTelefono: '3000000002',
      direccion: 'Avenida 5 # 12-40, barrio Latino',
      latitud: 7.8975,
      longitud: -72.4989,
      numeroVictimas: 1,
    },
    historia: {
      paciente: {
        pacienteIdentificado: true,
        nombres: 'Ana Lucía',
        apellidos: 'Torres Villamizar',
        tipoDocumento: 'CC',
        numeroDocumento: '9900000002',
        sexo: 'femenino',
        edadAproximada: 72,
        aseguradoraEps: 'EPS Demo Salud',
        regimenAfiliacion: 'subsidiado',
        acompananteNombre: 'Diana Torres',
        acompananteTelefono: '3000000002',
      },
      clinica: {
        tipoEvento: 'caida',
        mecanismoLesion: 'Caída desde su propia altura',
        aViaAerea: 'Permeable',
        bRespiracion: 'Normal',
        cCirculacion: 'Normal',
        dNeurologico: 'Alerta',
        eExposicion: 'Equimosis en cadera derecha',
        triage: 'verde',
        medicamentosHabituales: 'Lorazepam en la noche, furosemida',
        antecedentes: 'Osteoporosis, hipertensión',
        impresionDiagnostica: 'Contusión de cadera derecha',
        desenlace: 'rechazo_traslado',
        motivoRechazo:
          'La paciente no desea ser trasladada; su hija la llevará a control mañana',
      },
      signos: [
        {
          presionSistolica: 138,
          presionDiastolica: 84,
          frecuenciaCardiaca: 82,
          frecuenciaRespiratoria: 18,
          saturacionOxigeno: 96,
          glasgowOcular: 4,
          glasgowVerbal: 5,
          glasgowMotor: 6,
          escalaDolor: 4,
        },
      ],
      lesiones: [
        {
          regionCorporal: 'pelvis',
          tipoLesion: 'contusion',
          descripcion: 'Equimosis en cadera derecha, moviliza la pierna',
        },
      ],
      downton: {
        ...SIN_MEDICAMENTOS_DOWNTON,
        caidasPrevias: true,
        medTranquilizantesSedantes: true,
        medDiureticos: true,
        deficitVisual: true,
        deficitAuditivo: false,
        deficitExtremidades: false,
        estadoMental: 'orientado',
        deambulacion: 'segura_con_ayuda',
      },
      observacionCierreServicio:
        'La paciente rechaza el traslado; firma el disentimiento',
      firmas: [{ rolFirmante: 'paciente', proposito: 'disentimiento' }],
    },
  },
  {
    codigo: 'DEMO-03',
    haceDias: 23,
    hora: '22:05',
    ambulancia: 'TAB',
    alcance: 'completo',
    emergencia: {
      fuente: 'radio',
      modalidad: 'emergencia',
      tipoIncidente: 'arma',
      prioridad: 'amarilla',
      descripcion: 'Hombre con herida en el brazo después de una riña',
      informanteNombre: 'Patrulla de policía',
      direccion: 'Calle 8 # 20-15, barrio Comuneros',
      latitud: 7.8812,
      longitud: -72.4935,
      numeroVictimas: 1,
    },
    historia: {
      paciente: {
        pacienteIdentificado: true,
        nombres: 'Jhon Fredy',
        apellidos: 'Cárdenas Ortega',
        tipoDocumento: 'CC',
        numeroDocumento: '9900000003',
        sexo: 'masculino',
        edadAproximada: 31,
        regimenAfiliacion: 'no_afiliado',
      },
      clinica: {
        tipoEvento: 'arma_blanca',
        mecanismoLesion: 'Herida con arma cortopunzante',
        xHemorragiaMasiva: 'Sangrado controlado con presión directa',
        aViaAerea: 'Permeable',
        bRespiracion: 'Normal',
        cCirculacion: 'Pulsos presentes',
        dNeurologico: 'Alerta, con aliento alcohólico',
        eExposicion: 'Herida en antebrazo izquierdo',
        triage: 'verde',
        impresionDiagnostica: 'Herida superficial de antebrazo izquierdo',
        desenlace: 'rechazo_traslado',
        motivoRechazo:
          'El paciente se niega al traslado y a firmar; se informan los riesgos',
      },
      signos: [
        {
          presionSistolica: 128,
          presionDiastolica: 80,
          frecuenciaCardiaca: 94,
          frecuenciaRespiratoria: 18,
          saturacionOxigeno: 97,
          glasgowOcular: 4,
          glasgowVerbal: 5,
          glasgowMotor: 6,
        },
      ],
      lesiones: [
        {
          regionCorporal: 'miembro_superior_izquierdo',
          tipoLesion: 'herida',
          descripcion: 'Herida lineal de 4 cm en antebrazo, bordes limpios',
        },
      ],
      intervenciones: [
        {
          tipo: 'procedimiento',
          nombre: 'Limpieza y vendaje compresivo',
          resultado: 'Sangrado controlado',
        },
      ],
      observacionCierreServicio:
        'El paciente rechaza el traslado y no firma; firma un testigo',
      firmas: [
        {
          rolFirmante: 'paciente',
          proposito: 'disentimiento',
          motivoSinFirma: 'se_nego',
        },
        {
          rolFirmante: 'testigo',
          proposito: 'disentimiento',
          nombreFirmante: 'Martha Lucía Ibarra',
          tipoDocumento: 'CC',
          numeroDocumento: '9900000103',
        },
      ],
    },
  },
  {
    codigo: 'DEMO-04',
    haceDias: 21,
    hora: '05:30',
    ambulancia: 'TAM',
    alcance: 'completo',
    emergencia: {
      fuente: 'linea_123',
      modalidad: 'emergencia',
      tipoIncidente: 'clinico',
      prioridad: 'roja',
      descripcion: 'Hombre inconsciente, no respira, familiares inician RCP',
      informanteNombre: 'Andrés Pabón',
      informanteTelefono: '3000000004',
      direccion: 'Carrera 15 # 3-60, barrio San Luis',
      latitud: 7.9041,
      longitud: -72.4877,
      numeroVictimas: 1,
    },
    historia: {
      paciente: {
        pacienteIdentificado: true,
        nombres: 'Luis Eduardo',
        apellidos: 'Pabón Contreras',
        tipoDocumento: 'CC',
        numeroDocumento: '9900000004',
        sexo: 'masculino',
        edadAproximada: 67,
        regimenAfiliacion: 'contributivo',
        acompananteNombre: 'Andrés Pabón',
        acompananteTelefono: '3000000004',
      },
      clinica: {
        tipoEvento: 'clinico',
        aViaAerea: 'Sin esfuerzo respiratorio',
        bRespiracion: 'Ausente',
        cCirculacion: 'Sin pulso central, asistolia en el monitor',
        dNeurologico: 'Glasgow 3, pupilas midriáticas',
        triage: 'negro',
        antecedentes: 'Cardiopatía isquémica',
        impresionDiagnostica: 'Paro cardiorrespiratorio no recuperado',
        observaciones:
          'Se realizan 30 min de reanimación avanzada sin retorno de circulación. Se informa a la familia y a la autoridad competente.',
        desenlace: 'fallecido_en_sitio',
      },
      signos: [],
      intervenciones: [
        {
          tipo: 'procedimiento',
          nombre: 'Reanimación cardiopulmonar avanzada',
          resultado: 'Sin retorno de la circulación espontánea',
        },
        {
          tipo: 'medicamento',
          nombre: 'Adrenalina',
          dosis: '1 mg cada 3-5 min (6 dosis)',
          via: 'intravenosa',
        },
      ],
      observacionCierreServicio: 'Paciente fallecido en el sitio',
      firmas: [],
    },
  },
  {
    codigo: 'DEMO-05',
    haceDias: 18,
    hora: '18:15',
    ambulancia: 'TAB',
    alcance: 'completo',
    emergencia: {
      fuente: 'linea_123',
      modalidad: 'accidente_transito',
      tipoIncidente: 'accidente_transito',
      prioridad: 'roja',
      descripcion: 'Choque entre moto y carro, motociclista en el piso',
      informanteNombre: 'Testigo en la vía',
      informanteTelefono: '3000000005',
      direccion: 'Avenida Libertadores con calle 17',
      referenciaLugar: 'Frente a la estación de servicio',
      latitud: 7.9123,
      longitud: -72.4951,
      numeroVictimas: 1,
    },
    historia: {
      paciente: {
        pacienteIdentificado: true,
        nombres: 'Kevin Alexander',
        apellidos: 'Rojas Bautista',
        tipoDocumento: 'CC',
        numeroDocumento: '9900000005',
        sexo: 'masculino',
        edadAproximada: 24,
        fechaNacimiento: new Date('2002-01-20T00:00:00.000Z'),
        aseguradoraEps: 'EPS Demo Bienestar',
        regimenAfiliacion: 'subsidiado',
      },
      clinica: {
        tipoEvento: 'transito',
        rolVictima: 'motociclista',
        mecanismoLesion: 'Colisión moto contra automóvil a velocidad media',
        elementosProteccion: 'Casco',
        placaVehiculo: 'DEM12A',
        polizaSoat: 'SOAT-DEMO-0005',
        aViaAerea: 'Permeable, con control cervical',
        bRespiracion: 'Normal',
        cCirculacion: 'Taquicárdico, pulsos presentes',
        dNeurologico: 'Glasgow 15',
        eExposicion: 'Deformidad en pierna derecha, herida en mentón',
        triage: 'amarillo',
        alergias: 'Penicilina',
        impresionDiagnostica: 'Fractura cerrada de tibia derecha',
        desenlace: 'trasladado',
      },
      signos: [
        {
          presionSistolica: 124,
          presionDiastolica: 78,
          frecuenciaCardiaca: 112,
          frecuenciaRespiratoria: 22,
          saturacionOxigeno: 97,
          glasgowOcular: 4,
          glasgowVerbal: 5,
          glasgowMotor: 6,
          escalaDolor: 9,
        },
        {
          presionSistolica: 120,
          presionDiastolica: 76,
          frecuenciaCardiaca: 100,
          frecuenciaRespiratoria: 20,
          saturacionOxigeno: 98,
          escalaDolor: 7,
        },
      ],
      lesiones: [
        {
          regionCorporal: 'miembro_inferior_derecho',
          tipoLesion: 'fractura',
          descripcion: 'Deformidad en tercio medio de la pierna',
        },
        {
          regionCorporal: 'cara',
          tipoLesion: 'herida',
          descripcion: 'Herida de 2 cm en el mentón',
        },
      ],
      intervenciones: [
        {
          tipo: 'procedimiento',
          nombre: 'Inmovilización con férula y collar cervical',
        },
        {
          tipo: 'medicamento',
          nombre: 'Dipirona',
          dosis: '2 g',
          via: 'intravenosa',
          resultado: 'Disminuye el dolor a 7/10',
        },
      ],
      entrega: {
        institucion: 'central',
        condicionEntrega: 'Estable, inmovilizado',
        receptorNombre: 'Jorge Mario Leal',
        receptorCargo: 'Enfermero jefe de urgencias',
      },
      // Receptor opcional en esta modalidad: queda solo su nombre en la historia.
      firmas: [{ rolFirmante: 'paciente', proposito: 'comprobante_atencion' }],
    },
  },
  {
    codigo: 'DEMO-06',
    haceDias: 15,
    hora: '07:50',
    ambulancia: 'TAM',
    alcance: 'completo',
    emergencia: {
      fuente: 'telefono',
      modalidad: 'accidente_transito',
      tipoIncidente: 'accidente_transito',
      prioridad: 'amarilla',
      descripcion: 'Niña en bicicleta atropellada por una moto',
      informanteNombre: 'Marcela Ortiz',
      informanteTelefono: '3000000006',
      direccion: 'Calle 22 # 7-10, barrio Blanco',
      latitud: 7.8858,
      longitud: -72.5103,
      numeroVictimas: 1,
    },
    historia: {
      paciente: {
        pacienteIdentificado: true,
        nombres: 'Valentina',
        apellidos: 'Ortiz Duarte',
        tipoDocumento: 'TI',
        numeroDocumento: '9900000006',
        sexo: 'femenino',
        edadAproximada: 12,
        fechaNacimiento: new Date('2014-06-03T00:00:00.000Z'),
        aseguradoraEps: 'EPS Demo Salud',
        regimenAfiliacion: 'contributivo',
        acompananteNombre: 'Marcela Ortiz Duarte',
        acompananteTelefono: '3000000006',
      },
      clinica: {
        tipoEvento: 'transito',
        rolVictima: 'ciclista',
        mecanismoLesion: 'Atropellada por motocicleta a baja velocidad',
        elementosProteccion: 'Ninguno',
        polizaSoat: 'SOAT-DEMO-0006',
        aViaAerea: 'Permeable',
        bRespiracion: 'Normal',
        cCirculacion: 'Normal',
        dNeurologico: 'Alerta, llorosa',
        eExposicion: 'Abrasiones en brazo derecho',
        triage: 'verde',
        impresionDiagnostica: 'Trauma leve de miembro superior derecho',
        desenlace: 'trasladado',
      },
      signos: [
        {
          presionSistolica: 108,
          presionDiastolica: 68,
          frecuenciaCardiaca: 104,
          frecuenciaRespiratoria: 22,
          saturacionOxigeno: 99,
          glasgowOcular: 4,
          glasgowVerbal: 5,
          glasgowMotor: 6,
          escalaDolor: 5,
        },
      ],
      lesiones: [
        {
          regionCorporal: 'miembro_superior_derecho',
          tipoLesion: 'herida',
          descripcion: 'Abrasiones en antebrazo y codo',
        },
      ],
      intervenciones: [
        { tipo: 'procedimiento', nombre: 'Limpieza y cubrimiento de heridas' },
      ],
      entrega: {
        institucion: 'norte',
        condicionEntrega: 'Estable, acompañada por su madre',
        receptorNombre: 'Liliana Prada Ruiz',
        receptorCargo: 'Pediatra de urgencias',
      },
      // Menor de edad: firma su madre como acudiente.
      firmas: [
        {
          rolFirmante: 'acudiente',
          proposito: 'comprobante_atencion',
          nombreFirmante: 'Marcela Ortiz Duarte',
          tipoDocumento: 'CC',
          numeroDocumento: '9900000106',
          parentesco: 'madre',
        },
        {
          rolFirmante: 'receptor',
          proposito: 'entrega',
          nombreFirmante: 'Liliana Prada Ruiz',
          cargo: 'Pediatra de urgencias',
        },
      ],
    },
  },
  {
    codigo: 'DEMO-07',
    haceDias: 12,
    hora: '09:00',
    ambulancia: 'TAB',
    alcance: 'completo',
    emergencia: {
      fuente: 'telefono',
      modalidad: 'traslado_programado',
      tipoIncidente: 'clinico',
      prioridad: 'verde',
      descripcion: 'Traslado programado a sesión de diálisis',
      informanteNombre: 'Central de autorizaciones EPS Demo',
      informanteTelefono: '3000000007',
      direccion: 'Carrera 3 # 9-18, barrio El Contento',
      latitud: 7.8934,
      longitud: -72.5141,
      numeroVictimas: 1,
    },
    historia: {
      paciente: {
        pacienteIdentificado: true,
        nombres: 'Rosa Elena',
        apellidos: 'Galvis Moreno',
        tipoDocumento: 'CC',
        numeroDocumento: '9900000007',
        sexo: 'femenino',
        edadAproximada: 81,
        fechaNacimiento: new Date('1945-09-30T00:00:00.000Z'),
        aseguradoraEps: 'EPS Demo Bienestar',
        regimenAfiliacion: 'subsidiado',
        acompananteNombre: 'Hernando Galvis',
        acompananteTelefono: '3000000077',
      },
      clinica: {
        tipoEvento: 'clinico',
        aViaAerea: 'Permeable',
        bRespiracion: 'Normal',
        cCirculacion: 'Normal',
        dNeurologico: 'Orientada, lenta para responder',
        triage: 'verde',
        medicamentosHabituales: 'Furosemida, enalapril, sertralina',
        antecedentes: 'Enfermedad renal crónica en diálisis',
        impresionDiagnostica: 'Traslado para hemodiálisis programada',
        desenlace: 'trasladado',
      },
      signos: [
        {
          presionSistolica: 142,
          presionDiastolica: 86,
          frecuenciaCardiaca: 76,
          frecuenciaRespiratoria: 16,
          saturacionOxigeno: 95,
          temperatura: 36.4,
          glucometria: 118,
        },
      ],
      downton: {
        ...SIN_MEDICAMENTOS_DOWNTON,
        caidasPrevias: true,
        medDiureticos: true,
        medHipotensores: true,
        medAntidepresivos: true,
        deficitVisual: true,
        deficitAuditivo: true,
        deficitExtremidades: true,
        estadoMental: 'orientado',
        deambulacion: 'insegura',
      },
      entrega: {
        institucion: 'central',
        condicionEntrega: 'Estable, para sesión de diálisis',
        receptorNombre: 'Yesenia Carrillo',
        receptorCargo: 'Enfermera de la unidad renal',
      },
      // Traslado programado: comprobante y receptor obligatorios.
      firmas: [
        { rolFirmante: 'paciente', proposito: 'comprobante_atencion' },
        {
          rolFirmante: 'receptor',
          proposito: 'entrega',
          nombreFirmante: 'Yesenia Carrillo',
          cargo: 'Enfermera de la unidad renal',
          tipoDocumento: 'CC',
          numeroDocumento: '9900000207',
        },
      ],
    },
  },
  {
    codigo: 'DEMO-08',
    haceDias: 9,
    hora: '11:30',
    ambulancia: 'TAM',
    alcance: 'completo',
    emergencia: {
      fuente: 'telefono',
      modalidad: 'traslado_interhospitalario',
      tipoIncidente: 'clinico',
      prioridad: 'roja',
      descripcion:
        'Remisión a UCI: paciente intubado desde Hospital Demo Central',
      informanteNombre: 'Referencia Hospital Demo Central',
      informanteTelefono: '3000000008',
      direccion: 'Hospital Demo Central, Avenida 0 # 10-50',
      latitud: 7.8862,
      longitud: -72.4979,
      numeroVictimas: 1,
    },
    historia: {
      paciente: {
        pacienteIdentificado: true,
        nombres: 'Jorge Iván',
        apellidos: 'Mantilla Rangel',
        tipoDocumento: 'CC',
        numeroDocumento: '9900000008',
        sexo: 'masculino',
        edadAproximada: 49,
        aseguradoraEps: 'EPS Demo Salud',
        regimenAfiliacion: 'contributivo',
      },
      clinica: {
        tipoEvento: 'clinico',
        aViaAerea: 'Tubo orotraqueal N.º 8 fijo a 22 cm',
        bRespiracion: 'Ventilación mecánica',
        cCirculacion: 'Con noradrenalina en infusión',
        dNeurologico: 'Sedado, RASS -4',
        triage: 'rojo',
        antecedentes: 'Neumonía grave, choque séptico',
        impresionDiagnostica: 'Choque séptico de origen pulmonar',
        desenlace: 'trasladado',
      },
      signos: [
        {
          presionSistolica: 98,
          presionDiastolica: 58,
          frecuenciaCardiaca: 118,
          frecuenciaRespiratoria: 16,
          saturacionOxigeno: 93,
          temperatura: 38.4,
          glasgowOcular: 1,
          glasgowVerbal: 1,
          glasgowMotor: 1,
        },
        {
          presionSistolica: 102,
          presionDiastolica: 60,
          frecuenciaCardiaca: 112,
          frecuenciaRespiratoria: 16,
          saturacionOxigeno: 94,
        },
      ],
      intervenciones: [
        {
          tipo: 'medicamento',
          nombre: 'Noradrenalina',
          dosis: '0,1 mcg/kg/min',
          via: 'intravenosa',
        },
        {
          tipo: 'procedimiento',
          nombre: 'Ventilación mecánica de transporte',
        },
      ],
      entrega: {
        institucion: 'norte',
        condicionEntrega: 'Crítico, estable durante el traslado',
        receptorNombre: 'Ricardo Álvarez Soto',
        receptorCargo: 'Médico intensivista',
      },
      // El paciente no puede firmar y no hay acudiente; el receptor sí es obligatorio.
      firmas: [
        {
          rolFirmante: 'paciente',
          proposito: 'comprobante_atencion',
          motivoSinFirma: 'inconsciente_sin_acudiente',
        },
        {
          rolFirmante: 'receptor',
          proposito: 'entrega',
          nombreFirmante: 'Ricardo Álvarez Soto',
          cargo: 'Médico intensivista',
        },
      ],
    },
  },
  {
    codigo: 'DEMO-09',
    haceDias: 6,
    hora: '16:20',
    ambulancia: 'TAB',
    alcance: 'completo',
    emergencia: {
      fuente: 'radio',
      modalidad: 'atencion_en_sitio',
      tipoIncidente: 'clinico',
      prioridad: 'amarilla',
      descripcion: 'Mujer con desmayo en evento deportivo',
      informanteNombre: 'Logística del evento',
      direccion: 'Estadio Demo, tribuna oriental',
      latitud: 7.9002,
      longitud: -72.5185,
      numeroVictimas: 1,
    },
    historia: {
      paciente: {
        pacienteIdentificado: true,
        nombres: 'Sandra Milena',
        apellidos: 'Ruiz Becerra',
        tipoDocumento: 'CC',
        numeroDocumento: '9900000009',
        sexo: 'femenino',
        edadAproximada: 36,
        regimenAfiliacion: 'especial_excepcion',
      },
      clinica: {
        tipoEvento: 'clinico',
        aViaAerea: 'Permeable',
        bRespiracion: 'Normal',
        cCirculacion: 'Diaforética',
        dNeurologico: 'Somnolienta, responde al llamado',
        triage: 'amarillo',
        antecedentes: 'Diabetes tipo 1',
        medicamentosHabituales: 'Insulina',
        impresionDiagnostica: 'Hipoglucemia resuelta',
        desenlace: 'atendido_en_sitio',
        observaciones:
          'Glucometría de control 112 mg/dL. Se dan recomendaciones y queda con su familia.',
      },
      signos: [
        {
          presionSistolica: 112,
          presionDiastolica: 70,
          frecuenciaCardiaca: 98,
          frecuenciaRespiratoria: 18,
          saturacionOxigeno: 98,
          glucometria: 52,
          glasgowOcular: 3,
          glasgowVerbal: 4,
          glasgowMotor: 6,
        },
        {
          presionSistolica: 118,
          presionDiastolica: 72,
          frecuenciaCardiaca: 84,
          glucometria: 112,
          glasgowOcular: 4,
          glasgowVerbal: 5,
          glasgowMotor: 6,
        },
      ],
      intervenciones: [
        {
          tipo: 'medicamento',
          nombre: 'Dextrosa al 10 %',
          dosis: '250 mL',
          via: 'intravenosa',
          resultado: 'Glucometría de control 112 mg/dL',
        },
      ],
      observacionCierreServicio:
        'Paciente estable, se resuelve en el sitio sin traslado',
      firmas: [{ rolFirmante: 'paciente', proposito: 'comprobante_atencion' }],
    },
  },
  {
    codigo: 'DEMO-10',
    haceDias: 4,
    hora: '01:45',
    ambulancia: 'TAM',
    alcance: 'completo',
    emergencia: {
      fuente: 'linea_123',
      modalidad: 'emergencia',
      tipoIncidente: 'otro',
      prioridad: 'roja',
      descripcion: 'Hombre tirado en la vía, inconsciente, sin documentos',
      informanteNombre: 'Conductor de taxi',
      informanteTelefono: '3000000010',
      direccion: 'Anillo vial occidental, km 3',
      latitud: 7.9189,
      longitud: -72.5236,
      numeroVictimas: 1,
    },
    historia: {
      // Sin identificar (AS): no entra al índice de pacientes.
      paciente: {
        pacienteIdentificado: false,
        tipoDocumento: 'AS',
        sexo: 'masculino',
        edadAproximada: 35,
      },
      clinica: {
        tipoEvento: 'otro',
        mecanismoLesion: 'Desconocido, posible caída o atropellamiento',
        aViaAerea: 'Ronquido, se maneja con cánula orofaríngea',
        bRespiracion: 'Superficial',
        cCirculacion: 'Pulsos presentes, llenado capilar lento',
        dNeurologico: 'Glasgow 8, anisocoria',
        eExposicion: 'Hematoma en región parietal derecha',
        triage: 'rojo',
        impresionDiagnostica: 'Trauma craneoencefálico severo',
        desenlace: 'trasladado',
      },
      signos: [
        {
          presionSistolica: 150,
          presionDiastolica: 70,
          frecuenciaCardiaca: 58,
          frecuenciaRespiratoria: 10,
          saturacionOxigeno: 88,
          glasgowOcular: 2,
          glasgowVerbal: 2,
          glasgowMotor: 4,
        },
      ],
      lesiones: [
        {
          regionCorporal: 'cabeza',
          tipoLesion: 'trauma_cerrado',
          descripcion: 'Hematoma parietal derecho',
        },
      ],
      intervenciones: [
        {
          tipo: 'procedimiento',
          nombre: 'Cánula orofaríngea y oxígeno con máscara de no reinhalación',
          resultado: 'Saturación 95 %',
        },
      ],
      entrega: {
        institucion: 'central',
        condicionEntrega: 'Crítico, Glasgow 8',
        receptorNombre: 'Natalia Herrera',
        receptorCargo: 'Médica de urgencias',
      },
      firmas: [
        {
          rolFirmante: 'paciente',
          proposito: 'comprobante_atencion',
          motivoSinFirma: 'inconsciente_sin_acudiente',
        },
      ],
    },
  },
  {
    codigo: 'DEMO-11',
    haceDias: 2,
    hora: '10:10',
    ambulancia: 'TAB',
    alcance: 'completo',
    emergencia: {
      fuente: 'telefono',
      modalidad: 'emergencia',
      tipoIncidente: 'clinico',
      prioridad: 'amarilla',
      descripcion: 'Hombre con dificultad para respirar (ya atendido antes)',
      informanteNombre: 'Gloria Peña',
      informanteTelefono: '3000000001',
      direccion: 'Calle 10 # 4-25, barrio La Playa',
      latitud: 7.8891,
      longitud: -72.5012,
      numeroVictimas: 1,
    },
    historia: {
      // Mismo paciente que DEMO-01: su ficha muestra 2 ingresos.
      paciente: {
        pacienteIdentificado: true,
        nombres: 'Carlos Andrés',
        apellidos: 'Ramírez Peña',
        tipoDocumento: 'CC',
        numeroDocumento: '9900000001',
        sexo: 'masculino',
        edadAproximada: 58,
        fechaNacimiento: new Date('1968-04-12T00:00:00.000Z'),
        aseguradoraEps: 'EPS Demo Salud',
        regimenAfiliacion: 'contributivo',
        acompananteNombre: 'Gloria Peña',
        acompananteTelefono: '3000000001',
      },
      clinica: {
        tipoEvento: 'clinico',
        aViaAerea: 'Permeable',
        bRespiracion: 'Sibilancias, uso de músculos accesorios',
        cCirculacion: 'Normal',
        dNeurologico: 'Alerta',
        triage: 'amarillo',
        alergias: 'Niega',
        medicamentosHabituales: 'Losartán, clopidogrel',
        antecedentes: 'Hipertensión, síndrome coronario hace un mes',
        impresionDiagnostica: 'Crisis broncoobstructiva',
        desenlace: 'trasladado',
      },
      signos: [
        {
          presionSistolica: 140,
          presionDiastolica: 88,
          frecuenciaCardiaca: 102,
          frecuenciaRespiratoria: 28,
          saturacionOxigeno: 89,
          glasgowOcular: 4,
          glasgowVerbal: 5,
          glasgowMotor: 6,
        },
        {
          frecuenciaCardiaca: 96,
          frecuenciaRespiratoria: 22,
          saturacionOxigeno: 94,
        },
      ],
      intervenciones: [
        {
          tipo: 'medicamento',
          nombre: 'Salbutamol',
          dosis: '4 inhalaciones',
          via: 'inhalada',
          resultado: 'Mejora la saturación a 94 %',
        },
      ],
      entrega: {
        institucion: 'central',
        condicionEntrega: 'Estable, con oxígeno',
        receptorNombre: 'Jorge Mario Leal',
        receptorCargo: 'Enfermero jefe de urgencias',
      },
      firmas: [
        { rolFirmante: 'paciente', proposito: 'comprobante_atencion' },
        {
          rolFirmante: 'receptor',
          proposito: 'entrega',
          nombreFirmante: 'Jorge Mario Leal',
          cargo: 'Enfermero jefe de urgencias',
        },
      ],
    },
  },
  {
    codigo: 'DEMO-13',
    haceDias: 1,
    hora: '20:00',
    ambulancia: 'TAB',
    alcance: 'cancelada',
    emergencia: {
      fuente: 'telefono',
      modalidad: 'emergencia',
      tipoIncidente: 'caida',
      prioridad: 'verde',
      descripcion: 'Joven con torcedura de tobillo jugando fútbol',
      informanteNombre: 'Sebastián Duarte',
      informanteTelefono: '3000000013',
      direccion: 'Cancha del barrio Motilones',
      latitud: 7.9078,
      longitud: -72.5268,
      numeroVictimas: 1,
    },
    motivoCancelacion:
      'La familia lo llevó por sus propios medios a la clínica',
  },
  {
    codigo: 'DEMO-12',
    haceDias: null,
    minutosAtras: 45,
    ambulancia: 'TAM',
    alcance: 'en_curso',
    emergencia: {
      fuente: 'linea_123',
      modalidad: 'accidente_transito',
      tipoIncidente: 'accidente_transito',
      prioridad: 'amarilla',
      descripcion: 'Volcamiento de carro particular, conductor consciente',
      informanteNombre: 'Agente de tránsito',
      informanteTelefono: '3000000012',
      direccion: 'Autopista internacional, frente a la zona franca',
      latitud: 7.8721,
      longitud: -72.4762,
      numeroVictimas: 1,
    },
    historia: {
      paciente: {
        pacienteIdentificado: true,
        nombres: 'Mauricio',
        apellidos: 'León Salcedo',
        tipoDocumento: 'CC',
        numeroDocumento: '9900000012',
        sexo: 'masculino',
        edadAproximada: 42,
      },
      clinica: {
        tipoEvento: 'transito',
        rolVictima: 'conductor',
        elementosProteccion: 'Cinturón de seguridad, airbag',
        aViaAerea: 'Permeable',
        triage: 'amarillo',
      },
      signos: [
        {
          presionSistolica: 132,
          presionDiastolica: 84,
          frecuenciaCardiaca: 98,
          saturacionOxigeno: 97,
        },
      ],
      firmas: [],
    },
  },
  {
    codigo: 'DEMO-14',
    haceDias: null,
    minutosAtras: 8,
    ambulancia: 'TAB',
    alcance: 'recibida',
    emergencia: {
      fuente: 'linea_123',
      modalidad: 'emergencia',
      tipoIncidente: 'clinico',
      prioridad: 'amarilla',
      descripcion: 'Mujer embarazada con dolor abdominal intenso',
      informanteNombre: 'Jaime Rincón',
      informanteTelefono: '3000000014',
      direccion: 'Calle 15 # 1E-30, barrio Caobos',
      latitud: 7.8968,
      longitud: -72.4934,
      numeroVictimas: 1,
    },
  },
];
