import {
  AmbulanciasMemoria,
  crearAmbulanciaPrueba,
} from '../../../../../../test/dobles/ambulancias_memoria.js';
import { AsignacionesMemoria } from '../../../../../../test/dobles/asignaciones_memoria.js';
import {
  EmergenciasMemoria,
  crearEmergenciaPrueba,
} from '../../../../../../test/dobles/emergencias_memoria.js';
import {
  AuditoriaMemoria,
  HashFalso,
  UsuariosMemoria,
} from '../../../../../../test/dobles/repositorios_memoria.js';
import {
  TurnosMemoria,
  crearTurnoPrueba,
} from '../../../../../../test/dobles/turnos_memoria.js';
import { Roles } from '../../../../../common/constants/roles.js';
import {
  AccesoDenegadoError,
  ReglaNegocioError,
} from '../../../../../common/exceptions/errores_dominio.js';
import { Asignacion } from '../../../../assignments/domain/entities/asignacion.entity.js';
import { Usuario } from '../../../../users/domain/entities/usuario.entity.js';
import { FirmaElectronicaHistoria } from '../../../application/services/firma_electronica.service.js';
import { PoliticaFirmaCierre } from '../../../application/services/politica_firma_cierre.js';
import { FirmaUsuario } from '../../../../signatures/domain/entities/firma_usuario.entity.js';
import {
  AlmacenamientoFirmasMemoria,
  crearPngPrueba,
  FirmasUsuariosMemoria,
} from '../../../../signatures/test/dobles/firmas_memoria.js';
import { RegistrarFirmaHistoria } from '../../../application/use-cases/registrar_firma_historia.use-case.js';
import { QuitarFirmaHistoria } from '../../../application/use-cases/quitar_firma_historia.use-case.js';
import { AccesoHistoriaClinica } from '../../../application/services/acceso_historia_clinica.service.js';
import { HuellaHistoria } from '../../../application/services/huella_historia.service.js';
import { AbrirHistoriaClinica } from '../../../application/use-cases/abrir_historia_clinica.use-case.js';
import { ActualizarHistoriaClinica } from '../../../application/use-cases/actualizar_historia_clinica.use-case.js';
import { AnularHistoriaClinica } from '../../../application/use-cases/anular_historia_clinica.use-case.js';
import { CerrarHistoriaClinica } from '../../../application/use-cases/cerrar_historia_clinica.use-case.js';
import { ConsultarHistoriasClinicas } from '../../../application/use-cases/consultar_historias_clinicas.use-case.js';
import { ObtenerHistoriaClinica } from '../../../application/use-cases/obtener_historia_clinica.use-case.js';
import { RegistrarEnHistoria } from '../../../application/use-cases/registrar_en_historia.use-case.js';
import { InstitucionSalud } from '../../../domain/entities/institucion_salud.entity.js';
import type { MedicionesSignoVital } from '../../../domain/entities/registros_clinicos.js';
import {
  HistoriasClinicasMemoria,
  IndicePacientesMemoria,
  InstitucionesSaludMemoria,
} from '../../dobles/historias_memoria.js';

const paramedico = {
  usuarioId: 'paramedico-1',
  direccionIp: null,
  rol: Roles.PARAMEDICO,
};
const conductor = {
  usuarioId: 'conductor-1',
  direccionIp: null,
  rol: Roles.CONDUCTOR,
};
const admin = {
  usuarioId: 'admin-1',
  direccionIp: null,
  rol: Roles.ADMINISTRADOR,
};

const SIGNOS: MedicionesSignoVital = {
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
  escalaDolor: 3,
};

/** Lo que envía la app al firmar el cierre. */
const FIRMA = { contrasena: 'Secreta2026', aceptaDeclaracion: true };

describe('Historia clínica (casos de uso)', () => {
  let historias: HistoriasClinicasMemoria;
  let instituciones: InstitucionesSaludMemoria;
  let auditoria: AuditoriaMemoria;
  let indice: IndicePacientesMemoria;
  let asignacion: Asignacion;
  let abrir: AbrirHistoriaClinica;
  let actualizar: ActualizarHistoriaClinica;
  let registrar: RegistrarEnHistoria;
  let cerrar: CerrarHistoriaClinica;
  let obtener: ObtenerHistoriaClinica;
  let consultar: ConsultarHistoriasClinicas;
  let anular: AnularHistoriaClinica;
  let hospitalId: string;
  let firmas: FirmasUsuariosMemoria;
  let firmaRegistrada: FirmaUsuario;
  let usuarios: UsuariosMemoria;
  let registrarFirma: RegistrarFirmaHistoria;
  let quitarFirma: QuitarFirmaHistoria;
  let almacenFirmas: AlmacenamientoFirmasMemoria;

  /** El paciente no pudo firmar el comprobante (basta en las modalidades "si es posible"). */
  function comprobanteSinFirma(historiaId: string) {
    return registrarFirma.ejecutar(
      historiaId,
      {
        rolFirmante: 'paciente',
        proposito: 'comprobante_atencion',
        motivoSinFirma: 'inconsciente_sin_acudiente',
      },
      paramedico,
    );
  }

  /** El cierre con la política dada (por defecto: firma registrada obligatoria). */
  function crearCierre(exigeFirmaRegistrada = true) {
    return new CerrarHistoriaClinica(
      historias,
      new AccesoHistoriaClinica(
        historias,
        asignacionesDePrueba,
        turnosDePrueba,
      ),
      new HuellaHistoria(),
      new FirmaElectronicaHistoria(usuarios, new HashFalso(), auditoria),
      firmas,
      new PoliticaFirmaCierre(exigeFirmaRegistrada),
      auditoria,
    );
  }
  let asignacionesDePrueba: AsignacionesMemoria;
  let turnosDePrueba: TurnosMemoria;

  beforeEach(async () => {
    const ambulancias = new AmbulanciasMemoria();
    const emergencias = new EmergenciasMemoria();
    const turnos = new TurnosMemoria();
    const asignaciones = new AsignacionesMemoria(ambulancias, emergencias);
    historias = new HistoriasClinicasMemoria();
    instituciones = new InstitucionesSaludMemoria();
    auditoria = new AuditoriaMemoria();
    indice = new IndicePacientesMemoria();

    const ambulancia = await ambulancias.crear(crearAmbulanciaPrueba());
    const turno = await turnos.crear(crearTurnoPrueba(ambulancia.id));
    const emergencia = await emergencias.crear(crearEmergenciaPrueba());
    asignacion = Asignacion.crear({
      emergenciaId: emergencia.id,
      ambulanciaId: ambulancia.id,
      turnoId: turno.id,
      asignadaPorId: 'despachador-1',
      asignadaEn: new Date(),
    });
    asignaciones.asignaciones.set(asignacion.id, asignacion);
    const hospital = await instituciones.crear(
      InstitucionSalud.crear({ nombre: 'Hospital Erasmo Meoz' }),
    );
    hospitalId = hospital.id;

    const acceso = new AccesoHistoriaClinica(historias, asignaciones, turnos);
    abrir = new AbrirHistoriaClinica(historias, acceso, auditoria, indice);
    actualizar = new ActualizarHistoriaClinica(
      historias,
      instituciones,
      acceso,
      auditoria,
      indice,
    );
    registrar = new RegistrarEnHistoria(historias, acceso, auditoria);
    asignacionesDePrueba = asignaciones;
    turnosDePrueba = turnos;
    usuarios = new UsuariosMemoria();
    usuarios.usuarios.set(
      paramedico.usuarioId,
      Usuario.reconstruir({
        id: paramedico.usuarioId,
        nombres: 'Lucía',
        apellidos: 'Rojas',
        correo: 'lucia@galenos.co',
        telefono: null,
        contrasenaHash: `hash:${FIRMA.contrasena}`,
        estado: 'activo',
        rol: Roles.PARAMEDICO,
        ultimoAcceso: null,
        creadoEn: new Date(),
      }),
    );
    firmas = new FirmasUsuariosMemoria();
    firmaRegistrada = await firmas.registrar(
      FirmaUsuario.registrar({
        usuarioId: paramedico.usuarioId,
        claveAlmacenamiento: crypto.randomUUID(),
        imagen: { tamanoBytes: 1000, anchoPx: 600, altoPx: 200 },
        huellaSha256: 'b'.repeat(64),
        fecha: new Date(),
      }),
    );
    cerrar = crearCierre();
    almacenFirmas = new AlmacenamientoFirmasMemoria();
    registrarFirma = new RegistrarFirmaHistoria(
      historias,
      acceso,
      almacenFirmas,
      auditoria,
    );
    quitarFirma = new QuitarFirmaHistoria(
      historias,
      acceso,
      almacenFirmas,
      auditoria,
    );
    obtener = new ObtenerHistoriaClinica(historias, acceso, auditoria);
    consultar = new ConsultarHistoriasClinicas(historias, acceso);
    anular = new AnularHistoriaClinica(historias, acceso, auditoria);
  });

  async function abrirHistoria(id?: string) {
    return (
      await abrir.ejecutar({ id, asignacionId: asignacion.id }, paramedico)
    ).detalle.historia;
  }

  it('el paramédico del servicio abre la historia con número consecutivo', async () => {
    const primera = await abrirHistoria();
    const segunda = await abrirHistoria();

    expect(primera.numeroHistoria).toMatch(/^HC-\d{8}-0001$/);
    expect(segunda.numeroHistoria).toMatch(/^HC-\d{8}-0002$/);
    expect(primera.emergenciaId).toBe(asignacion.emergenciaId);
    expect(auditoria.eventos[0]?.detalle).toEqual({
      numeroHistoria: primera.numeroHistoria,
      asignacionId: asignacion.id,
    });
  });

  it('reenviar el mismo id desde el celular no duplica la historia', async () => {
    const id = '0c6f1d2e-3b4a-4c5d-8e9f-a0b1c2d3e4f5';
    await abrirHistoria(id);

    const reintento = await abrir.ejecutar(
      { id, asignacionId: asignacion.id },
      paramedico,
    );

    expect(reintento.creada).toBe(false);
    expect(historias.historias.size).toBe(1);
  });

  it('el conductor no puede abrir ni ver historias clínicas', async () => {
    await expect(
      abrir.ejecutar({ asignacionId: asignacion.id }, conductor),
    ).rejects.toThrow(AccesoDenegadoError);
    const historia = await abrirHistoria();
    await expect(
      obtener.ejecutar(
        historia.id,
        { usuarioId: conductor.usuarioId, rol: conductor.rol },
        conductor,
      ),
    ).rejects.toThrow(AccesoDenegadoError);
  });

  it('un paramédico de otra ambulancia no puede verla; el administrador sí', async () => {
    const historia = await abrirHistoria();

    await expect(
      obtener.ejecutar(
        historia.id,
        { usuarioId: 'paramedico-2', rol: Roles.PARAMEDICO },
        paramedico,
      ),
    ).rejects.toThrow(AccesoDenegadoError);
    const detalle = await obtener.ejecutar(
      historia.id,
      { usuarioId: admin.usuarioId, rol: admin.rol },
      admin,
    );
    expect(detalle.historia.id).toBe(historia.id);
    expect(auditoria.eventos.at(-1)?.accion).toBe('consultar');
  });

  it('registra signos vitales sin duplicar al reenviar el mismo id', async () => {
    const historia = await abrirHistoria();
    const id = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

    await registrar.signoVital(
      historia.id,
      { id, mediciones: SIGNOS },
      paramedico,
    );
    const repetido = await registrar.signoVital(
      historia.id,
      { id, mediciones: SIGNOS },
      paramedico,
    );

    expect(repetido.glasgowTotal).toBe(15);
    expect(historias.signos).toHaveLength(1);
  });

  it('no deja asignar una institución de destino que no existe', async () => {
    const historia = await abrirHistoria();
    await expect(
      actualizar.ejecutar(
        historia.id,
        { institucionDestinoId: crypto.randomUUID() },
        paramedico,
      ),
    ).rejects.toThrow('institución de destino');
  });

  it('flujo completo: llenar, intentar cerrar incompleta, completar, cerrar y quedar sellada', async () => {
    const historia = await abrirHistoria();
    await actualizar.ejecutar(
      historia.id,
      {
        pacienteIdentificado: true,
        nombres: 'Juan',
        apellidos: 'Pérez',
        triage: 'amarillo',
      },
      paramedico,
    );
    await registrar.lesion(
      historia.id,
      { regionCorporal: 'miembro_inferior_derecho', tipoLesion: 'fractura' },
      paramedico,
    );
    await registrar.intervencion(
      historia.id,
      { tipo: 'procedimiento', nombre: 'Inmovilización' },
      paramedico,
    );

    await expect(
      cerrar.ejecutar(historia.id, FIRMA, paramedico),
    ).rejects.toThrow(/desenlace.*signos vitales/);

    await registrar.signoVital(historia.id, { mediciones: SIGNOS }, paramedico);
    const detalle = await actualizar.ejecutar(
      historia.id,
      {
        desenlace: 'trasladado',
        institucionDestinoId: hospitalId,
        receptorNombre: 'Dra. Gómez',
      },
      paramedico,
    );
    expect(detalle.lesiones).toHaveLength(1);

    await expect(
      cerrar.ejecutar(historia.id, FIRMA, paramedico),
    ).rejects.toThrow(/comprobante de atención/);
    await comprobanteSinFirma(historia.id);
    const cerrada = await cerrar.ejecutar(historia.id, FIRMA, paramedico);
    expect(cerrada.historia.estado).toBe('cerrada');
    expect(cerrada.historia.hashCierre).toMatch(/^[0-9a-f]{64}$/);
    expect(cerrada.historia.cerradaPorId).toBe('paramedico-1');

    await expect(
      actualizar.ejecutar(historia.id, { observaciones: 'cambio' }, paramedico),
    ).rejects.toThrow(ReglaNegocioError);
    await expect(
      registrar.signoVital(historia.id, { mediciones: SIGNOS }, paramedico),
    ).rejects.toThrow(ReglaNegocioError);
  });

  it('la auditoría guarda los nombres de los campos, nunca los datos clínicos', async () => {
    const historia = await abrirHistoria();
    await actualizar.ejecutar(
      historia.id,
      { nombres: 'Juan', alergias: 'Penicilina' },
      paramedico,
    );

    const evento = auditoria.eventos.at(-1);
    expect(evento?.detalle).toEqual({ campos: ['nombres', 'alergias'] });
    expect(JSON.stringify(auditoria.eventos)).not.toContain('Penicilina');
  });

  it('lista las historias del servicio para su tripulación', async () => {
    await abrirHistoria();
    await abrirHistoria();
    const lista = await consultar.ejecutar(
      { asignacionId: asignacion.id },
      { usuarioId: paramedico.usuarioId, rol: paramedico.rol },
    );
    expect(lista).toHaveLength(2);
  });

  it('el administrador anula sin borrar y deja el motivo en la auditoría', async () => {
    const historia = await abrirHistoria();
    const anulada = await anular.ejecutar(
      historia.id,
      'Abierta por error',
      admin,
    );

    expect(anulada.estado).toBe('anulada');
    expect(auditoria.eventos.at(-1)?.detalle).toEqual({
      estadoAnterior: 'borrador',
      motivo: 'Abierta por error',
    });
  });

  describe('firma electrónica del cierre', () => {
    async function historiaLista() {
      const historia = await abrirHistoria();
      await actualizar.ejecutar(
        historia.id,
        { triage: 'verde', desenlace: 'fallecido_en_sitio' },
        paramedico,
      );
      return historia;
    }

    it('con la contraseña correcta firma, cierra y deja en la auditoría el método y la declaración', async () => {
      const historia = await historiaLista();

      const { historia: cerrada } = await cerrar.ejecutar(
        historia.id,
        FIRMA,
        paramedico,
      );

      expect(cerrada.estado).toBe('cerrada');
      expect(cerrada.cerradaPorId).toBe(paramedico.usuarioId);
      expect(auditoria.eventos.at(-1)).toMatchObject({
        accion: 'cerrar',
        detalle: {
          metodoFirma: 'reautenticacion_contrasena',
          versionDeclaracion: 'v1',
        },
      });
    });

    it('con una contraseña errada no firma: sigue en borrador y queda el intento, sin la contraseña', async () => {
      const historia = await historiaLista();

      await expect(
        cerrar.ejecutar(
          historia.id,
          { ...FIRMA, contrasena: 'Equivocada1' },
          paramedico,
        ),
      ).rejects.toThrow(/no se firmó/);

      expect(historias.historias.get(historia.id)?.estado).toBe('borrador');
      const intento = auditoria.eventos.at(-1);
      expect(intento?.accion).toBe('firma_rechazada');
      expect(JSON.stringify(intento)).not.toContain('Equivocada1');
    });

    it('sin aceptar la declaración no firma', async () => {
      const historia = await historiaLista();

      await expect(
        cerrar.ejecutar(
          historia.id,
          { ...FIRMA, aceptaDeclaracion: false },
          paramedico,
        ),
      ).rejects.toThrow(ReglaNegocioError);
      expect(historias.historias.get(historia.id)?.estado).toBe('borrador');
    });
  });

  describe('firma registrada estampada al cerrar', () => {
    async function historiaLista() {
      const historia = await abrirHistoria();
      await actualizar.ejecutar(
        historia.id,
        { triage: 'verde', desenlace: 'fallecido_en_sitio' },
        paramedico,
      );
      return historia;
    }

    it('estampa la versión vigente de la firma y la deja en la auditoría', async () => {
      const historia = await historiaLista();

      const { historia: cerrada } = await cerrar.ejecutar(
        historia.id,
        FIRMA,
        paramedico,
      );

      expect(cerrada.firmaCierre).toEqual({
        id: firmaRegistrada.id,
        huellaSha256: firmaRegistrada.huellaSha256,
        registradaEn: firmaRegistrada.registradaEn,
      });
      expect(auditoria.eventos.at(-1)?.detalle).toMatchObject({
        firmaCierreId: firmaRegistrada.id,
      });
    });

    it('sin firma registrada no cierra, salvo durante la transición', async () => {
      firmas.firmas.clear();
      const historia = await historiaLista();

      await expect(
        cerrar.ejecutar(historia.id, FIRMA, paramedico),
      ).rejects.toThrow(/Registre su firma/);
      expect(historias.historias.get(historia.id)?.estado).toBe('borrador');

      const { historia: cerrada } = await crearCierre(false).ejecutar(
        historia.id,
        FIRMA,
        paramedico,
      );
      expect(cerrada.estado).toBe('cerrada');
      expect(cerrada.firmaCierre).toBeNull();
    });

    it('la huella cubre la firma estampada y la hora de entrega que se pone al cerrar', async () => {
      const historia = await abrirHistoria();
      await registrar.signoVital(
        historia.id,
        { mediciones: SIGNOS },
        paramedico,
      );
      await actualizar.ejecutar(
        historia.id,
        {
          triage: 'amarillo',
          desenlace: 'trasladado',
          institucionDestinoId: hospitalId,
          receptorNombre: 'Dra. Gómez',
        },
        paramedico,
      );

      await registrarFirma.ejecutar(
        historia.id,
        {
          rolFirmante: 'acudiente',
          proposito: 'comprobante_atencion',
          nombreFirmante: 'María Pérez Gómez',
          tipoDocumento: 'CC',
          numeroDocumento: '60.123.456',
          parentesco: 'madre',
          imagen: crearPngPrueba(),
        },
        paramedico,
      );
      const detalle = await cerrar.ejecutar(historia.id, FIRMA, paramedico);

      expect(detalle.historia.datos.entregadoEn).not.toBeNull();
      const huella = new HuellaHistoria();
      expect(detalle.historia.hashCierre).toBe(
        huella.calcular(detalle, detalle.historia.firmaCierre),
      );
      expect(detalle.historia.hashCierre).not.toBe(
        huella.calcular(detalle, null),
      );
    });
  });

  it('guarda el régimen de afiliación del paciente', async () => {
    const historia = await abrirHistoria();
    const detalle = await actualizar.ejecutar(
      historia.id,
      { aseguradoraEps: 'Nueva EPS', regimenAfiliacion: 'subsidiado' },
      paramedico,
    );
    expect(detalle.historia.datos.regimenAfiliacion).toBe('subsidiado');
  });

  describe('firmas del paciente, familiar, testigo y receptor', () => {
    it('toma la firma: guarda la imagen, no duplica al reenviar y la auditoría no lleva nombres', async () => {
      const historia = await abrirHistoria();
      await actualizar.ejecutar(
        historia.id,
        { nombres: 'Juan', numeroDocumento: '1090123456', tipoDocumento: 'CC' },
        paramedico,
      );
      const id = '7d1e2f3a-4b5c-4d6e-8f70-81a2b3c4d5e6';
      const datos = {
        id,
        rolFirmante: 'paciente' as const,
        proposito: 'comprobante_atencion' as const,
        imagen: crearPngPrueba(),
      };

      const firma = await registrarFirma.ejecutar(
        historia.id,
        datos,
        paramedico,
      );
      await registrarFirma.ejecutar(historia.id, datos, paramedico);

      expect(firma.nombreFirmante).toBe('Juan');
      expect(historias.firmasHistoria).toHaveLength(1);
      expect(almacenFirmas.archivos.size).toBe(1);
      const evento = auditoria.eventos.at(-1);
      expect(evento?.accion).toBe('registrar_firma_paciente');
      expect(JSON.stringify(evento)).not.toMatch(/Juan|1090123456/);
    });

    it('una segunda firma del mismo rol y propósito da 409 y no deja la imagen', async () => {
      const historia = await abrirHistoria();
      await comprobanteSinFirma(historia.id);
      await expect(
        registrarFirma.ejecutar(
          historia.id,
          {
            rolFirmante: 'paciente',
            proposito: 'comprobante_atencion',
            motivoSinFirma: 'fallecido',
          },
          paramedico,
        ),
      ).rejects.toThrow(/Ya hay una firma/);
    });

    it('rechazo con el paciente negándose: exige un testigo para cerrar', async () => {
      const historia = await abrirHistoria();
      await registrar.signoVital(
        historia.id,
        { mediciones: SIGNOS },
        paramedico,
      );
      await actualizar.ejecutar(
        historia.id,
        {
          triage: 'verde',
          desenlace: 'rechazo_traslado',
          motivoRechazo: 'No quiere ir',
        },
        paramedico,
      );
      await registrarFirma.ejecutar(
        historia.id,
        {
          rolFirmante: 'paciente',
          proposito: 'disentimiento',
          motivoSinFirma: 'se_nego',
        },
        paramedico,
      );
      await expect(
        cerrar.ejecutar(historia.id, FIRMA, paramedico),
      ).rejects.toThrow(/testigo/);

      await registrarFirma.ejecutar(
        historia.id,
        {
          rolFirmante: 'testigo',
          proposito: 'disentimiento',
          nombreFirmante: 'Carlos Ruiz Díaz',
          tipoDocumento: 'CC',
          numeroDocumento: '88123456',
          imagen: crearPngPrueba(),
        },
        paramedico,
      );
      const { historia: cerrada } = await cerrar.ejecutar(
        historia.id,
        FIRMA,
        paramedico,
      );
      expect(cerrada.estado).toBe('cerrada');
    });

    it('quitar en borrador borra el registro y la imagen; cerrada ya no se puede', async () => {
      const historia = await abrirHistoria();
      await actualizar.ejecutar(
        historia.id,
        { triage: 'verde', desenlace: 'fallecido_en_sitio' },
        paramedico,
      );
      const firma = await registrarFirma.ejecutar(
        historia.id,
        {
          rolFirmante: 'acudiente',
          proposito: 'comprobante_atencion',
          nombreFirmante: 'María Pérez',
          tipoDocumento: 'CC',
          numeroDocumento: '60123456',
          parentesco: 'madre',
          imagen: crearPngPrueba(),
        },
        paramedico,
      );

      await quitarFirma.ejecutar(historia.id, firma.id, paramedico);
      expect(historias.firmasHistoria).toHaveLength(0);
      expect(almacenFirmas.archivos.size).toBe(0);
      expect(auditoria.eventos.at(-1)?.accion).toBe('eliminar_firma_acudiente');

      await cerrar.ejecutar(historia.id, FIRMA, paramedico);
      await expect(comprobanteSinFirma(historia.id)).rejects.toThrow(
        ReglaNegocioError,
      );
    });
  });

  it('enlaza la historia al índice de pacientes cuando se guarda el documento', async () => {
    const historia = await abrirHistoria();
    await actualizar.ejecutar(historia.id, { triage: 'verde' }, paramedico);
    expect(indice.enlaces.has(historia.id)).toBe(false);

    await actualizar.ejecutar(
      historia.id,
      { tipoDocumento: 'CC', numeroDocumento: '1.090.123.456' },
      paramedico,
    );
    expect(indice.enlaces.get(historia.id)).toBe('CC 1090123456');

    await actualizar.ejecutar(
      historia.id,
      { numeroDocumento: null },
      paramedico,
    );
    expect(indice.enlaces.get(historia.id)).toBeNull();
  });
});
