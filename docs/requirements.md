# Requisitos

> **Modelo vigente:** el Área TI opera con cuentas individuales `admin` activas.
> No existe toma ni asignación obligatoria. Las transiciones son compartidas,
> se auditan con el ID real de la sesión y el reporte de eficiencia está
> restringido a ADMIN.

## Contexto y alcance

Usuarios operadores: tres cuentas individuales del Área TI con rol `admin` activo y permisos operativos equivalentes. Personas atendidas: estudiantes, docentes y administrativos; no se requiere que tengan cuentas en el sistema. El tipo de persona, también llamado tipo de solicitante, se limita a esos tres valores.

Los operadores registran las incidencias antes de atenderlas, inician la atención desde una cola compartida, registran la solución y cierran el ticket. No existe toma ni asignación individual obligatoria. El canal puede ser presencial o el número institucional compartido de WhatsApp Business; en la primera versión el canal se guarda como dato y no existe integración técnica.

Los requisitos siguientes describen el producto esperado. Las ampliaciones propuestas se distinguen de las reglas confirmadas.

## Supuestos

Estos supuestos orientan el diseño y deben confirmarse durante la fase 1:

- Una sola institución educativa, sin multiempresa ni múltiples sedes con catálogos separados.
- Tres operadores con cuentas individuales y permisos operativos equivalentes. Las tres cuentas usan rol `admin` activo; el reporte de eficiencia queda reservado a ese rol. No existe asignación individual obligatoria.
- Un único número institucional de WhatsApp Business, usado como fuente manual de contexto.
- Interfaz en español y uso desde navegadores de escritorio modernos.
- Supabase y Cloudflare operan como servicios administrados; no se mantiene infraestructura propia.

## Requisitos funcionales

| ID | Requisito | Verificación esperada |
| --- | --- | --- |
| RF-01 | Autenticar al técnico y permitir cerrar su sesión. | Una sesión inválida no puede consultar ni modificar datos protegidos. |
| RF-02 | Registrar manualmente un ticket antes de atender la incidencia, sin utilizar IA. | El registro funciona aun si el proveedor está deshabilitado o caído; el ticket nace en estado `nuevo`, sin técnico y sin solución. |
| RF-03 | Registrar asunto, descripción, categoría, nombre y tipo de solicitante y canal de origen; la ubicación es opcional. | El servidor rechaza datos obligatorios ausentes o valores no permitidos. |
| RF-04 | Derivar el actor de cada operación de la sesión autenticada, sin asignación individual obligatoria. | Una petición manipulada no permite suplantar al actor ni enviar un responsable arbitrario. |
| RF-05 | Generar en PostgreSQL un número único para cada ticket. | Dos registros concurrentes reciben números distintos y la base impide duplicados. |
| RF-06 | Permitir una ubicación opcional por ticket. | Puede omitirse y no se reutiliza como atributo permanente del solicitante. |
| RF-07 | Consultar y filtrar tickets por estado y categoría, y mostrar número, asunto, solicitante, responsable histórico y fecha. | Los filtros devuelven únicamente registros autorizados. |
| RF-08 | Interpretar texto del técnico mediante un chatbot y proponer clasificación. | Devuelve una categoría válida o solicita aclaración; no inventa categorías persistentes. |
| RF-09 | Presentar una vista previa editable con datos faltantes y dudas. | El técnico puede corregir campos antes de guardar; los datos no inferibles quedan pendientes y no se inventan. |
| RF-10 | Exigir confirmación explícita para registrar un borrador del chatbot. | Generar, editar o cancelar una propuesta no crea tickets. |
| RF-11 | Validar datos y permisos nuevamente al confirmar. | Una sesión vencida o una categoría desactivada bloquea el guardado con un mensaje claro. |
| RF-12 | Registrar cada transición en un historial inmutable con actor, fecha, estados y detalle. | Un fallo al escribir el historial revierte el cambio del ticket; el cliente no puede editar ni borrar eventos. |
| RF-13 | Mantener el contexto de tickets por WhatsApp sin conexión directa al servicio en la primera versión. | El registro admite información aportada manualmente; no requiere webhook ni credenciales de WhatsApp. |
| RF-14 | Incorporar posteriormente herramientas de IA con permisos y entradas limitadas. | Cada herramienta valida identidad, autorización y argumentos; ninguna escritura evita la confirmación humana. |
| RF-15 | Incorporar posteriormente conocimiento aprobado y recuperación RAG. | Las respuestas recuperadas respetan acceso y muestran su procedencia. |
| RF-16 | Incorporar posteriormente analítica ampliada y voz. El reporte de eficiencia del Área TI forma parte de la fase 1 mediante RF-24. | Los resultados se contrastan con datos autorizados y el texto de voz se revisa antes de confirmar. |
| RF-17 | Permitir que cualquier operador activo inicie la atención de un ticket de la cola compartida sin asignación individual. | El inicio usa el actor autenticado y no exige que el ticket esté asignado. |
| RF-18 | Permitir al operador activo iniciar la atención y registrar la fecha de inicio. | Solo un ticket en `nuevo` o `reabierto` puede pasar a `en_atencion`. |
| RF-19 | Permitir al operador activo resolver con una solución obligatoria y cerrar el ticket resuelto. | Sin solución no hay resolución; el cierre solo ocurre desde `resuelto`. |
| RF-20 | Permitir a cualquier operador activo reabrir un ticket resuelto o cerrado y devolverlo a la cola compartida. | El ticket pasa a `reabierto`, se limpian las fechas del ciclo y se conserva la solución anterior como referencia y en el historial. |
| RF-21 | Consultar el historial cronológico completo desde el detalle del ticket. | El historial muestra acciones, actor, fecha y detalle, ordenado del evento más antiguo al más reciente. |
| RF-22 | Impedir que dos operadores ejecuten la misma transición sobre el mismo ticket a la vez. | El segundo intento recibe un error normalizado de estado y no modifica el ticket. |
| RF-23 | Impedir el borrado físico de tickets y la modificación del historial desde el cliente. | No existen permisos ni políticas de `DELETE`; los triggers rechazan actualizaciones del historial. |
| RF-24 | Generar un reporte de eficiencia para `admin` activo con filtros por fecha, categoría y tipo de solicitante. | La tasa de resolución usa división decimal, los resueltos se cuentan por el evento real de resolución y los promedios usan el ciclo vigente tras una reapertura. |

Las funciones de edición o anulación de campos ya guardados se implementarán solo después de definir quién puede realizarlas. Toda función aprobada debe respetar RF-12 y RF-23.

## Requisitos no funcionales

| ID | Requisito | Criterio verificable |
| --- | --- | --- |
| RNF-01 | Control de acceso con Auth y RLS. | Pruebas negativas cubren acceso anónimo, sesión vencida y operaciones no autorizadas. |
| RNF-02 | Integridad de datos y atomicidad. | Restricciones en base de datos protegen referencias, tipos y unicidad; cada transición y su evento de historial se confirman juntos. |
| RNF-03 | Privacidad y minimización. | El proveedor recibe solo información necesaria; logs no almacenan secretos ni texto personal completo por defecto. |
| RNF-04 | Independencia del proveedor de IA. | Un adaptador alternativo puede cumplir el mismo contrato sin modificar el flujo de registro. |
| RNF-05 | Disponibilidad del flujo manual. | Las pruebas con IA inaccesible permiten autenticación, registro, consulta y transiciones mientras Supabase esté disponible. |
| RNF-06 | Interfaz comprensible y accesible. | Formularios utilizables con teclado, etiquetas asociadas, errores legibles y diseño adaptable; objetivo propuesto WCAG 2.2 AA. |
| RNF-07 | Trazabilidad operativa. | Los fallos de servidor tienen identificador de correlación y logs sin credenciales; el historial es consultable solo por personal activo. |
| RNF-08 | Mantenibilidad. | TypeScript, contratos de dominio, migraciones versionadas y verificaciones automatizadas al existir implementación. |
| RNF-09 | Rendimiento y consumo controlados. | Medir registro, consultas y latencia de IA; configurar límites de entrada, tiempo y frecuencia. Los umbrales se acuerdan antes de producción. |
| RNF-10 | Recuperabilidad. | Procedimiento de respaldo y restauración verificado antes de producción; RPO y RTO pendientes. |
| RNF-11 | Resistencia a fallos y duplicados. | Reintentos tras pérdida de respuesta no generan un segundo ticket; la clave de idempotencia y la huella del contenido lo impiden. |
| RNF-12 | Despliegue reproducible. | GitHub Actions verifica y compila; Cloudflare publica una versión identificable y permite seguir un procedimiento de reversión. |
| RNF-13 | Separación de responsabilidades en el código. | Tickets, autenticación e integraciones futuras viven en módulos separados; las validaciones reutilizables están en `domain`. |

## Trazabilidad

Cada regla de negocio debe quedar cubierta por al menos un requisito verificable:

| Regla | Requisitos que la materializan |
| --- | --- |
| RN-01 | RF-02, RF-03, RF-17 |
| RN-02 | RF-05 |
| RN-03 | RF-03, RF-07 |
| RN-04 | RF-04, RF-17 |
| RN-05 | RF-06 |
| RN-06 | RF-02, RNF-05 |
| RN-07 | RF-08, RF-09 |
| RN-08 | RF-10, RF-11 |
| RN-09 | RF-14, RNF-01, RNF-03 |
| RN-10 | RF-12, RF-21, RNF-02 |
| RN-11 | RF-13 |
| RN-12 | RF-08, RF-09 |
| RN-13 | RF-17, RF-18, RF-19, RF-20 |
| RN-14 | RF-02, RF-17 a RF-20, RF-24, RNF-01 |
| RN-15 | RF-19 |
| RN-16 | RF-23, RNF-02 |
| RN-17 | RF-22 |
| RN-18 | RF-02, RNF-11 |
| RN-19 | RF-20, RF-21 |

Distribución prevista por fase:

| Fase | Requisitos principales |
| --- | --- |
| 1 | RF-01 a RF-07, RF-12, RF-17 a RF-24; RNF-01, RNF-02, RNF-05, RNF-06, RNF-08, RNF-11, RNF-13 |
| 2 | RF-08 a RF-11; RNF-03, RNF-04, RNF-09 |
| 3 | RF-14 |
| 4 | RF-15 |
| 5 | RF-16 |
| 6 | RNF-07, RNF-10, RNF-12 y verificación integral |

## Fuera del alcance inicial

- SLA, priorización automática, asignación por especialidades y notificaciones automáticas.
- Integración directa con WhatsApp, lectura automática de conversaciones o envío de mensajes.
- Registro automático por IA y acceso administrativo directo del modelo a PostgreSQL.
- Edición libre o borrado físico de tickets; cualquier corrección futura requiere una operación auditada.
- RAG, voz y reportes avanzados antes de sus fases correspondientes.
- Portal de autoservicio para estudiantes, docentes o administrativos.
- Multiinstitución, múltiples sedes o catálogos independientes por unidad.
- Integración con inventario, directorio activo, correo o sistemas de facturación.
- Aplicación móvil nativa.

## Definiciones necesarias antes de implementar

Confirmar el catálogo definitivo de categorías, la política de correcciones, el formato definitivo del número y la zona horaria, y el responsable institucional de altas y bajas. La reasignación de tickets cuando un técnico se desactiva ya no bloquea la operación: cualquier cuenta activa puede continuar el ciclo (DP-09 resuelta por DA-31). Antes de producción, acordar conservación de tickets e historial, tratamiento de datos personales, métricas de rendimiento, límites de costos y recuperación.

El detalle de persistencia, RLS e idempotencia está en [diseño de base de datos](database-design.md). Las pruebas que verifican estos requisitos están en [estrategia de pruebas](testing-strategy.md). Los costos y límites de IA se controlan según [costos y límites](costs-and-limits.md).
