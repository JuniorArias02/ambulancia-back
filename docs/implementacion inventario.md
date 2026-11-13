# Implementación del módulo de inventario de ambulancias

Se va a desarrollar el módulo de inventario en una **rama independiente**, sin afectar ni integrar todavía estos cambios en la rama oficial del proyecto.

El objetivo es implementar un sistema de inventario que permita administrar los insumos, equipos, existencias y dotación de las ambulancias, manteniendo la trazabilidad de cada operación.

## 1. Roles y responsabilidades

- **Administradores y despachadores (Web):** son responsables de crear y administrar los insumos, registros sanitarios, bodegas, ubicaciones, lotes, equipos, perfiles de dotación y demás información administrativa del inventario. También gestionan las entradas, transferencias y demás movimientos que correspondan a la bodega.
- **Paramédico (Aplicación móvil):** es el único responsable de realizar las operaciones de inventario de la ambulancia. Puede consultar su inventario, registrar verificaciones, reportar novedades y registrar los movimientos o consumos que correspondan durante la operación.

**Importante:** el inventario de la ambulancia se gestiona desde la aplicación móvil. La administración de bodegas y la configuración general del inventario se realiza desde el frontend web.

## 2. Funcionalidad de las tablas

Implementar las siguientes funcionalidades respetando la estructura de la base de datos de la feature:

| Tabla | Función y forma de registro |
|---|---|
| `inv_insumos` | Catálogo general de medicamentos, dispositivos médicos, insumos asistenciales, equipos biomédicos, oxígeno y otros elementos. Los administradores crean y configuran cada elemento, indicando sus características y requisitos de control. |
| `inv_registros_sanitarios` | Almacena los registros sanitarios asociados a los insumos que los requieren. Se registra el número, tipo, vigencia, titular y documento de soporte. |
| `inv_bodegas` | Representa las bodegas centrales o de almacenamiento. Los administradores crean las bodegas y asignan sus responsables. |
| `inv_ubicaciones` | Identifica dónde se encuentra el inventario: una bodega o una ambulancia. Permite manejar ambos como ubicaciones independientes. |
| `inv_lotes` | Registra los lotes de los insumos que requieren control por lote, incluyendo número, fechas de fabricación y vencimiento, fabricante y proveedor. |
| `inv_equipos` | Registra individualmente los equipos biomédicos y demás elementos que requieren seguimiento por número de serie, estado y mantenimiento. |
| `inv_existencias` | Mantiene las cantidades disponibles de cada insumo en cada ubicación. Se actualiza según las entradas, transferencias, consumos, devoluciones y ajustes confirmados. |
| `inv_movimientos` | Registra las operaciones generales del inventario: entradas, transferencias, consumos, devoluciones, ajustes y bajas. Debe conservar el responsable, motivo, estado y ubicaciones involucradas. |
| `inv_movimiento_detalles` | Contiene los elementos, lotes o equipos y cantidades involucradas en cada movimiento. Es el detalle de cada operación registrada. |
| `inv_controles_almacenamiento` | Registra controles de condiciones de almacenamiento, como temperatura y humedad, asociados a una ubicación y al usuario responsable. |
| `inv_mantenimientos` | Registra los mantenimientos preventivos, correctivos y calibraciones de los equipos, incluyendo fechas, responsable, proveedor y soportes. |
| `inv_perfiles_dotacion` | Define la dotación que debe tener cada tipo de ambulancia. Permite crear versiones de los perfiles y establecer su vigencia. |
| `inv_perfil_dotacion_detalles` | Define los insumos y equipos que componen cada perfil, sus cantidades requeridas, cantidades mínimas y si son obligatorios. |
| `inv_verificaciones` | Representa una revisión del inventario de una ubicación. Puede realizarse al inicio del turno, al finalizarlo o de manera extraordinaria. |
| `inv_verificacion_detalles` | Registra el resultado de revisar cada elemento: cantidad esperada, cantidad encontrada y novedades como faltantes, sobrantes, vencidos o dañados. |

## 3. Flujo general esperado

1. Los administradores y despachadores configuran los insumos, bodegas, lotes, equipos y perfiles de dotación desde el frontend web.
2. Se registran las existencias iniciales y las entradas correspondientes a las bodegas.
3. Cuando se requiere abastecer una ambulancia, se registra una transferencia desde la bodega hacia la ubicación de esa ambulancia.
4. El paramédico consulta desde la aplicación móvil los elementos asignados a su ambulancia.
5. El paramédico realiza las verificaciones del inventario y registra las cantidades encontradas y sus novedades.
6. Durante la operación, registra los consumos, devoluciones o novedades que correspondan.
7. Cada operación debe reflejarse en los movimientos y en las existencias correspondientes, conservando su trazabilidad.

## 4. Integración entre plataformas

- **Backend:** implementar la lógica y los endpoints necesarios para que el frontend web y la aplicación móvil consuman las funcionalidades del inventario.
- **Frontend web:** gestionar la administración general del inventario, bodegas, insumos, lotes, equipos, dotaciones, movimientos y demás configuraciones administrativas.
- **Aplicación móvil Flutter:** enfocarse exclusivamente en la gestión del inventario de la ambulancia por parte del paramédico: consulta, verificación, registro de novedades y operaciones permitidas.

La implementación debe contemplar la separación entre la administración del inventario central y la operación diaria del inventario de cada ambulancia.