/**
 * Cómo se muestran en documentos (PDF) los valores que la base guarda como
 * códigos. Un valor sin etiqueta se muestra tal cual.
 */
const ETIQUETAS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  estado: { borrador: 'En curso', cerrada: 'Cerrada', anulada: 'Anulada' },
  modalidad: {
    emergencia: 'Emergencia',
    accidente_transito: 'Accidente de tránsito',
    traslado_programado: 'Traslado programado',
    traslado_interhospitalario: 'Traslado entre instituciones',
    atencion_en_sitio: 'Atención en sitio',
  },
  triage: {
    rojo: 'Rojo (crítico)',
    amarillo: 'Amarillo (urgente)',
    verde: 'Verde (no urgente)',
    negro: 'Negro',
  },
  desenlace: {
    trasladado: 'Trasladado',
    rechazo_traslado: 'Rechazó el traslado',
    atendido_en_sitio: 'Atendido en el sitio',
    fallecido_en_sitio: 'Falleció en el sitio',
  },
  tipoEvento: {
    transito: 'Accidente de tránsito',
    caida: 'Caída',
    arma_fuego: 'Arma de fuego',
    arma_blanca: 'Arma blanca',
    quemadura: 'Quemadura',
    clinico: 'Clínico',
    otro: 'Otro',
  },
  sexo: {
    masculino: 'Masculino',
    femenino: 'Femenino',
    indeterminado: 'Indeterminado',
  },
  regimen: {
    contributivo: 'Contributivo',
    subsidiado: 'Subsidiado',
    especial_excepcion: 'Especial o de excepción',
    no_afiliado: 'No afiliado',
  },
  rolVictima: {
    conductor: 'Conductor',
    pasajero: 'Pasajero',
    peaton: 'Peatón',
    motociclista: 'Motociclista',
    ciclista: 'Ciclista',
  },
  tipoIntervencion: {
    procedimiento: 'Procedimiento',
    medicamento: 'Medicamento',
  },
  nivelRiesgo: { bajo: 'Bajo', alto: 'Alto' },
  estadoMental: { orientado: 'Orientado', confuso: 'Confuso' },
  deambulacion: {
    normal: 'Normal',
    segura_con_ayuda: 'Segura con ayuda',
    insegura: 'Insegura',
    imposible: 'Imposible',
  },
  rolFirmante: {
    paciente: 'Paciente',
    acudiente: 'Familiar',
    testigo: 'Testigo',
    receptor: 'Quien recibe',
  },
  proposito: {
    comprobante_atencion: 'Comprobante de atención',
    disentimiento: 'Disentimiento (rechazo del traslado)',
    entrega: 'Entrega del paciente',
  },
  motivoSinFirma: {
    inconsciente_sin_acudiente: 'Inconsciente y sin familiar',
    fallecido: 'Fallecido',
    se_nego: 'Se negó a firmar',
    otro: 'Otro',
  },
  parentesco: {
    padre: 'Padre',
    madre: 'Madre',
    hijo: 'Hijo(a)',
    conyuge_companero: 'Cónyuge o compañero(a)',
    hermano: 'Hermano(a)',
    abuelo: 'Abuelo(a)',
    nieto: 'Nieto(a)',
    tio: 'Tío(a)',
    sobrino: 'Sobrino(a)',
    primo: 'Primo(a)',
    otro_familiar: 'Otro familiar',
  },
};

export type CatalogoEtiquetas = keyof typeof ETIQUETAS;

/** "rechazo_traslado" → "Rechazó el traslado"; `null` → `null`. */
export function etiqueta(
  catalogo: CatalogoEtiquetas,
  valor: string | null | undefined,
): string | null {
  if (valor === null || valor === undefined || valor === '') return null;
  return ETIQUETAS[catalogo]?.[valor] ?? valor;
}

/** "regionCorporal" o "miembro_inferior_derecho" → "Miembro inferior derecho". */
export function legible(valor: string | null): string | null {
  if (!valor) return null;
  const texto = valor.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
}
