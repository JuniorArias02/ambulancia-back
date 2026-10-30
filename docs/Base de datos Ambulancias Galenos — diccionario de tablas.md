# Base de datos Ambulancias Galenos — diccionario de tablas

Oct 23, 2026 · @Junior Edimer Arias Castellanos

## Vista general

La base tiene 18 tablas en 5 grupos. El centro es la historia clínica prehospitalaria (HCP), que la app llena escuchando la conversación del paramédico con el paciente. Todo lo demás existe para saber qué ambulancia atendió, quién estaba a bordo y cuándo pasó cada cosa.

Recorrido de una emergencia por las tablas:

1. Entra la llamada → se crea una fila en `emergencias`.
2. El despachador envía una ambulancia → `asignaciones_servicio`, ligada al `turno` activo de esa ambulancia.
3. La ambulancia se mueve → `ubicaciones_ambulancias` guarda el GPS y `asignaciones_servicio` va marcando salida, llegada a escena y llegada al destino.
4. En escena se abre una `historias_clinicas` por cada paciente.
5. La app graba (`grabaciones`, `segmentos_audio`) y propone datos en `signos_vitales`, `lesiones` e `intervenciones`.
6. El paramédico confirma los datos, entrega el paciente en una `instituciones_salud` y cierra la HC.
7. Cada cambio importante queda en `auditoria_eventos`.

## 1. Usuarios y seguridad

Cada persona que usa el sistema tiene un usuario con un solo rol. Tripulantes y despachadores son usuarios; no hay tabla aparte de "personal".

| Tabla | Qué guarda | Puntos clave |
| --- | --- | --- |
| `roles` | Los tipos de usuario: admin, despachador, paramédico, médico, conductor. | Define qué puede hacer cada quien en la app. Un usuario tiene un rol. |
| `usuarios` | Las personas que entran al sistema: nombre, documento, correo, contraseña cifrada. | `registro_profesional` (ReTHUS) es necesario para quien firma una HC. |
| `auditoria_eventos` | Bitácora de quién hizo qué y cuándo: crear, editar, cerrar, anular o ver un registro. | `detalle` guarda los valores antes y después. Es la prueba legal de los cambios en una HC. |

## 2. Ambulancias y tripulaciones

Una ambulancia trabaja por turnos, y cada turno dice quiénes iban a bordo. Así se sabe qué tripulación atendió cada servicio.

| Tabla | Qué guarda | Puntos clave |
| --- | --- | --- |
| `tipos_ambulancia` | Las clases de ambulancia: básica (TAB) o medicalizada (TAM). | Sirve para saber qué servicios puede atender cada vehículo. |
| `ambulancias` | Cada vehículo: código interno, placa, tipo y estado actual. | `estado_operativo` (disponible, en servicio, fuera de servicio, mantenimiento) y la última posición GPS, para despachar rápido. |
| `turnos` | Un periodo de trabajo de una ambulancia, con inicio y fin. | Agrupa a la tripulación de ese periodo. |
| `turnos_integrantes` | Quiénes estaban en un turno y con qué función: conductor, paramédico o médico. | Una persona aparece una sola vez por turno. |
| `estados_ambulancia_historial` | Cada cambio de estado de una ambulancia, con motivo, usuario y hora. | Permite reconstruir cuánto tiempo estuvo disponible o fuera de servicio. |

## 3. Emergencias y despacho

Una emergencia es un evento (un choque, una caída); una asignación es una ambulancia enviada a ese evento. Una emergencia con varios heridos puede tener varias asignaciones.

| Tabla | Qué guarda | Puntos clave |
| --- | --- | --- |
| `emergencias` | Cada llamada o reporte recibido: quién llamó, qué pasó, dónde, prioridad y número de víctimas. | `emergencia_principal_id` marca las llamadas repetidas del mismo evento, en lugar de crear otra emergencia. |
| `asignaciones_servicio` | Cada ambulancia enviada a una emergencia y su estado: asignada, en camino, en escena, trasladando, finalizada. | Guarda las horas clave: salida, llegada a escena, salida de escena, llegada a destino. De ahí salen los tiempos de respuesta. |
| `ubicaciones_ambulancias` | Los puntos GPS que envía cada ambulancia, con hora y velocidad. | Es la tabla que más crece. `asignacion_id` permite ver el recorrido de un servicio. |
| `instituciones_salud` | Hospitales y clínicas a donde se llevan pacientes: nombre, código de habilitación, nivel, ubicación. | Es un catálogo; la HC apunta aquí como destino. |

## 4. Historia clínica prehospitalaria

Una HC es un paciente atendido en una emergencia. Casi todos los campos son opcionales, porque en trauma grave primero se atiende y después se completa.

| Tabla | Qué guarda | Puntos clave |
| --- | --- | --- |
| `historias_clinicas` | La HC completa de un paciente: datos personales, el evento, la valoración XABCDE, triage, antecedentes, impresión diagnóstica, desenlace y entrega. | El paciente va dentro de la HC, porque muchas veces es NN (`paciente_identificado`, `edad_aproximada`). Incluye datos de SOAT para accidentes de tránsito. El `id` se genera en el celular para trabajar sin señal. |
| `signos_vitales` | Cada toma de signos: presión, frecuencias, saturación, temperatura, glucometría, Glasgow por componentes, dolor. | Un paciente grave tiene varias tomas; cada una con su hora (`medido_en`). |
| `lesiones` | Cada lesión encontrada: región del cuerpo, tipo y descripción. | Una fila por lesión. |
| `intervenciones` | Lo que se hizo al paciente: procedimientos (inmovilización, torniquete, oxígeno) y medicamentos con dosis y vía. | Procedimientos y medicamentos van en la misma tabla, separados por `tipo`. |

Campos de la HC que conviene conocer:

- `desenlace`: trasladado, rechazo de traslado, atendido en sitio o fallecido en sitio. Si es rechazo, se exigen `motivo_rechazo` y `firma_rechazo_ref`.
- `estado`: borrador mientras se atiende, cerrada cuando el profesional la firma, anulada si hubo un error. Una HC cerrada no se edita.
- `hash_cierre`: huella del contenido al firmar; si alguien lo altera después, no coincide.
- `sincronizada_en`: cuándo llegó la HC al servidor desde el celular.

Las tres tablas hijas tienen los mismos tres campos de origen:

- `origen`: `manual` (lo escribió el paramédico) o `voz` (lo propuso la app al escuchar).
- `segmento_audio_id`: el trozo de audio de donde salió el dato.
- `confirmado`: si el paramédico aceptó el dato. Lo manual nace confirmado.

## 5. Escucha continua por voz

La app graba toda la atención y la guarda por trozos mientras graba, no al final. Si el celular se apaga, solo se pierde el último trozo.

| Tabla | Qué guarda | Puntos clave |
| --- | --- | --- |
| `grabaciones` | Una grabación por HC: cuándo empezó y terminó, su estado y qué motor de transcripción se usó. | Estados: grabando, subiendo, completa, error. |
| `segmentos_audio` | Cada trozo de audio (15 a 30 s): su orden, en qué segundo empieza y termina, quién habla, la transcripción y los datos que propuso la API. | `audio_ref` queda vacío hasta que el trozo se sube con señal. `hablante` evita tomar lo que dice el paciente como un hallazgo. `datos_extraidos` son propuestas, no datos finales. |

Cómo se conecta con la HC:

1. La API transcribe un trozo y devuelve campos en `datos_extraidos`.
2. La app crea filas en `signos_vitales`, `lesiones` o `intervenciones` con `origen = voz`, `confirmado = false` y el `segmento_audio_id` del trozo.
3. El paramédico ve la propuesta en pantalla y la acepta o la corrige; al aceptarla, `confirmado` pasa a `true`.
4. Si hay dudas sobre un dato, se puede volver al trozo exacto de audio y escucharlo.

## 6. Reglas que debe aplicar el código

La base de datos guarda los campos, pero no impide estos errores por sí sola. Hay que validarlos en el backend.

1. No se puede cerrar una HC si tiene datos con `origen = voz` y `confirmado = false`.
2. Si `desenlace = rechazo_traslado`, `motivo_rechazo` y `firma_rechazo_ref` son obligatorios.
3. Si `desenlace = trasladado`, se exigen `institucion_destino_id`, `receptor_nombre` y `entregado_en`.
4. Una HC con `estado = cerrada` no se edita; solo se puede anular, y la anulación queda en `auditoria_eventos`.
5. Al cerrar, se calcula `hash_cierre` sobre el contenido y se guarda quién firmó (`cerrada_por_id`), que debe tener `registro_profesional`.
6. Una ambulancia `en_servicio` o `fuera_servicio` no puede recibir otra asignación activa.
7. El audio se guarda cifrado y solo lo escuchan los roles autorizados, porque es un dato de salud sensible.
