# Semilla de demostración de APH

> Contexto general en [00-general.md](00-general.md). Implementada y verificada el 2026-11-17.

`npm run db:semilla:aph-demo` llena una BD de **desarrollo** con servicios completos, desde la llamada hasta la historia clínica cerrada y firmada. Sirve para probar el front, la app y la consulta clínica sin cargar datos a mano.

- **No corre en producción:** si `NODE_ENV=production`, se detiene.
- **Requiere:** `npm run db:semilla` (roles y tipos TAB/TAM) y `SEMILLA_DEMO_CONTRASENA` en el `.env`. Debe tener 10 caracteres como mínimo, con letras y números.
- **Se puede repetir:** el personal, las ambulancias y las instituciones se buscan antes de crearlos. Un escenario cuya emergencia ya existe (`[DEMO-NN]` al inicio de la descripción) se salta.
- **No hay script para borrar los datos:** la huella y las FK `Restrict` de las historias lo impiden, a propósito. Para empezar de cero se recrea la BD de desarrollo.

## Decisiones

1. **Usa los casos de uso reales, no `INSERT`.** Levanta Nest sin HTTP (`NestFactory.createApplicationContext(AppModule)`) y ejecuta lo mismo que el front y la app.
   - Así quedan bien los estados, los eventos de la asignación, el historial de la ambulancia, la auditoría, el índice de pacientes, las firmas cifradas y la huella SHA-256.
   - Si cambia una regla de negocio, la semilla falla en vez de generar datos inválidos.
2. **Se compila con `tsc`, no con `tsx`.** `tsx` (esbuild) no genera la metadata de decoradores y Nest no puede inyectar dependencias.
   - `tsconfig.semillas.json` compila a `dist/semillas/` y el script lo ejecuta con `node`.
   - `semilla_inventario_demo.ts` sigue con `tsx` porque solo usa Prisma.
3. **Reloj simulado** (`prisma/semillas/aph_demo/reloj_simulado.ts`). Los casos de uso toman la hora con `new Date()`. Para repartir los servicios en los últimos 30 días, el script reemplaza `Date` solo dentro de su proceso; la app no cambia.
   - Prisma también usa ese reloj en los `@default(now())`, como la creación de usuarios y ambulancias.
4. **Sin servicios externos.** Antes de cargar `AppModule` vacía `GEOAPIFY_API_KEY` y `TIEMPO_REAL_URL`: no pide rutas (Geoapify cobra por consulta) ni envía avisos de tiempo real.
5. **Firmas dibujadas en código** (`firma_png.ts`): PNG de 600×200 con fondo transparente, generado con `zlib` de Node.
   - Cada nombre produce siempre el mismo trazo.
   - Pasa la misma validación que exige la app y se guarda cifrada, así que el PDF las muestra.
6. **Antes de cerrar la conexión espera 1,5 s**, porque los suscriptores del bus de eventos corren en segundo plano.

## Lo que crea

- **Personal** (todos con la contraseña `SEMILLA_DEMO_CONTRASENA`):
  - `despachador@demo.local`;
  - `conductor.tab@demo.local` y `paramedico.tab@demo.local`;
  - `conductor.tam@demo.local` y `paramedico.tam@demo.local`.

  Cada paramédico registra su firma en "Mi firma".
- **Ambulancias** `DEMO-TAB` (DEM001) y `DEMO-TAM` (DEM002). Cada tripulación las selecciona como en la app, así que su turno queda activo.
- **Instituciones** "Clínica Demo Norte" y "Hospital Demo Central", con coordenadas.

**Flujo de cada servicio** (quién hace cada paso):
1. El despachador registra la emergencia y despacha la ambulancia.
2. El conductor marca `en_camino` y `en_escena` (con la posición de la escena).
3. El paramédico abre la historia y marca `atendiendo`. Luego registra lesiones, signos, intervenciones, Downton y la valoración.
4. Si hay traslado, el conductor elige el destino, marca `trasladando` y `finalizada`. Si no lo hay, marca `finalizada` con la observación.
5. El paramédico registra las firmas y cierra con su contraseña y la declaración.

## Escenarios (`prisma/semillas/aph_demo/escenarios.ts`)

| Código | Modalidad | Resultado | Lo que prueba |
| --- | --- | --- | --- |
| DEMO-01 | emergencia | trasladado | Firman el paciente y el receptor |
| DEMO-02 | emergencia | rechazo_traslado | Disentimiento firmado por la paciente; Downton |
| DEMO-03 | emergencia | rechazo_traslado | El paciente se niega a firmar (`se_nego`) y firma un testigo |
| DEMO-04 | emergencia | fallecido_en_sitio | Sin firmas ni signos vitales |
| DEMO-05 | accidente_transito | trasladado | Lesiones y SOAT; receptor opcional, sin su firma |
| DEMO-06 | accidente_transito | trasladado | Menor (TI); firma su madre como acudiente |
| DEMO-07 | traslado_programado | trasladado | Comprobante y receptor obligatorios; Downton de riesgo alto |
| DEMO-08 | traslado_interhospitalario | trasladado | Paciente inconsciente sin acudiente; receptor obligatorio |
| DEMO-09 | atencion_en_sitio | atendido_en_sitio | Sin traslado |
| DEMO-10 | emergencia | trasladado | Paciente sin identificar (AS): no entra al índice |
| DEMO-11 | emergencia | trasladado | Mismo paciente que DEMO-01: su ficha tiene 2 ingresos |
| DEMO-13 | emergencia | cancelada | Asignación y emergencia canceladas (ayer) |
| DEMO-12 | accidente_transito | en curso | `atendiendo` con la historia abierta (hoy); deja `DEMO-TAM` en servicio |
| DEMO-14 | emergencia | recibida | Pendiente de despacho (hoy) |

**Datos ficticios:**
- documentos de pacientes en el rango `99000000xx`, y de acudientes, testigos y receptores en `99000001xx` y `99000002xx`;
- teléfonos `30000000xx`;
- EPS "EPS Demo …".

## Verificado (2026-11-17, en una copia de la BD local)

- Los 14 escenarios se completan.
- Fechas repartidas del 20 de octubre al 17 de noviembre, con horas coherentes entre los pasos.
- Las 11 huellas recalculadas coinciden.
- Pacientes: el 9900000001 tiene 2 ingresos; el AS no está en el índice.
- El PDF muestra las firmas del acudiente, el receptor y el paramédico.
- 0 rutas pedidas a Geoapify.
- 194 eventos de auditoría con las fechas simuladas.
- Una segunda ejecución no duplica nada.
