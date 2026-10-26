# Requisitos

## Contexto y alcance

Usuarios operadores: tres técnicos de TI generalistas autenticados. Personas atendidas: estudiantes, docentes y administrativos; no se requiere que tengan cuentas en el sistema. El tipo de persona, también llamado tipo de solicitante, se limita a esos tres valores. El producto registra servicios ya solucionados, tanto presenciales como atendidos por el número institucional compartido de WhatsApp Business.

Los requisitos siguientes describen el producto esperado, no funcionalidades existentes. Las ampliaciones propuestas se distinguen de las reglas confirmadas.

## Supuestos

Estos supuestos orientan el diseño y deben confirmarse antes de la fase 1:

- Una sola institución educativa, sin multiempresa ni múltiples sedes con catálogos separados.
- Tres técnicos con cuentas individuales y permisos equivalentes; el volumen esperado es bajo.
- Un único número institucional de WhatsApp Business, usado como fuente manual de contexto.
- Interfaz en español y uso desde navegadores de escritorio modernos.
- Supabase y Cloudflare operan como servicios administrados; no se mantiene infraestructura propia.

## Requisitos funcionales

| ID | Requisito | Verificación esperada |
| --- | --- | --- |
| RF-01 | Autenticar al técnico y permitir cerrar su sesión. | Una sesión inválida no puede consultar ni modificar datos protegidos. |
| RF-02 | Registrar manualmente una atención ya solucionada sin utilizar IA. | El registro funciona aun si el proveedor está deshabilitado o caído. |
| RF-03 | Registrar categoría, nombre y tipo de persona, técnico responsable y fecha de atención. | El servidor rechaza datos obligatorios ausentes o valores no permitidos. |
| RF-04 | Obtener al técnico responsable de la sesión autenticada. | Una petición manipulada no permite asignar arbitrariamente otro responsable. |
| RF-05 | Generar en PostgreSQL un código único para cada ticket. | Dos registros concurrentes reciben códigos distintos y la base impide duplicados. |
| RF-06 | Permitir una ubicación opcional por atención. | Puede omitirse y no se reutiliza como atributo permanente del docente. |
| RF-07 | Consultar y filtrar atenciones por código, fecha, categoría, tipo de persona y técnico dentro de los permisos aprobados. | Los filtros devuelven únicamente registros autorizados. |
| RF-08 | Interpretar texto del técnico mediante un chatbot y proponer clasificación. | Devuelve una categoría válida o solicita aclaración; no inventa categorías persistentes. |
| RF-09 | Presentar una vista previa editable con datos faltantes y dudas. | El técnico puede corregir campos antes de guardar; los datos no inferibles quedan pendientes y no se inventan. |
| RF-10 | Exigir confirmación explícita para registrar un borrador del chatbot. | Generar, editar o cancelar una propuesta no crea tickets. |
| RF-11 | Validar datos y permisos nuevamente al confirmar. | Una sesión vencida o una categoría desactivada bloquea el guardado con un mensaje claro. |
| RF-12 | Auditar modificaciones relevantes. | Cada operación confirmada tiene actor, instante, entidad y detalle suficiente; un fallo de auditoría revierte la modificación. |
| RF-13 | Mantener el contexto de atenciones por WhatsApp sin conexión directa al servicio en la primera versión. | El registro admite información aportada manualmente; no requiere webhook ni credenciales de WhatsApp. |
| RF-14 | Incorporar posteriormente herramientas de IA con permisos y entradas limitadas. | Cada herramienta valida identidad, autorización y argumentos; ninguna escritura evita la confirmación humana. |
| RF-15 | Incorporar posteriormente conocimiento aprobado y recuperación RAG. | Las respuestas recuperadas respetan acceso y muestran su procedencia. |
| RF-16 | Incorporar posteriormente analítica, voz y reportes. | Los resultados se contrastan con datos autorizados y el texto de voz se revisa antes de confirmar. |

Las funciones de edición o anulación se implementarán solo después de definir quién puede realizarlas. Toda función aprobada debe respetar RF-12. La descripción del problema, solución aplicada y canal son campos propuestos; falta decidir su obligatoriedad.

## Requisitos no funcionales

| ID | Requisito | Criterio verificable |
| --- | --- | --- |
| RNF-01 | Control de acceso con Auth y RLS. | Pruebas negativas cubren acceso anónimo, sesión vencida y operaciones no autorizadas. |
| RNF-02 | Integridad de datos y atomicidad. | Restricciones en base de datos protegen referencias, tipos y unicidad; ticket y auditoría se confirman juntos. |
| RNF-03 | Privacidad y minimización. | El proveedor recibe solo información necesaria; logs no almacenan secretos ni texto personal completo por defecto. |
| RNF-04 | Independencia del proveedor de IA. | Un adaptador alternativo puede cumplir el mismo contrato sin modificar el flujo de registro. |
| RNF-05 | Disponibilidad del flujo manual. | Las pruebas con IA inaccesible permiten autenticación, registro y consulta mientras Supabase esté disponible. |
| RNF-06 | Interfaz comprensible y accesible. | Formularios utilizables con teclado, etiquetas asociadas, errores legibles y diseño adaptable; objetivo propuesto WCAG 2.2 AA. |
| RNF-07 | Trazabilidad operativa. | Los fallos de servidor tienen identificador de correlación y logs sin credenciales; auditoría consultable solo por perfiles autorizados. |
| RNF-08 | Mantenibilidad. | TypeScript, contratos de dominio, migraciones versionadas y verificaciones automatizadas al existir implementación. |
| RNF-09 | Rendimiento y consumo controlados. | Medir registro, consultas y latencia de IA; configurar límites de entrada, tiempo y frecuencia. Los umbrales se acuerdan antes de producción. |
| RNF-10 | Recuperabilidad. | Procedimiento de respaldo y restauración verificado antes de producción; RPO y RTO pendientes. |
| RNF-11 | Resistencia a fallos y duplicados. | Reintentos tras pérdida de respuesta no generan una segunda atención; el borrador permite recuperar la operación. |
| RNF-12 | Despliegue reproducible. | GitHub Actions verifica y compila; Cloudflare publica una versión identificable y permite seguir un procedimiento de reversión. |

## Trazabilidad

Cada regla de negocio debe quedar cubierta por al menos un requisito verificable:

| Regla | Requisitos que la materializan |
| --- | --- |
| RN-01 | RF-02, RF-03, RF-09, RF-11 |
| RN-02 | RF-05 |
| RN-03 | RF-03, RF-07 |
| RN-04 | RF-04, RF-11 |
| RN-05 | RF-06 |
| RN-06 | RF-02, RNF-05 |
| RN-07 | RF-08, RF-09 |
| RN-08 | RF-10, RF-11 |
| RN-09 | RF-14, RNF-01, RNF-03 |
| RN-10 | RF-12, RNF-02 |
| RN-11 | RF-13 |
| RN-12 | RF-08, RF-09 |

Distribución prevista por fase:

| Fase | Requisitos principales |
| --- | --- |
| 1 | RF-01 a RF-07, RF-12; RNF-01, RNF-02, RNF-05, RNF-06, RNF-08, RNF-11 |
| 2 | RF-08 a RF-11; RNF-03, RNF-04, RNF-09 |
| 3 | RF-14 |
| 4 | RF-15 |
| 5 | RF-16 |
| 6 | RNF-07, RNF-10, RNF-12 y verificación integral |

## Fuera del alcance inicial

- Tickets abiertos, colas, SLA de resolución y asignación por especialidades.
- Integración directa con WhatsApp, lectura automática de conversaciones o envío de mensajes.
- Registro automático por IA y acceso administrativo directo del modelo a PostgreSQL.
- RAG, voz y reportes avanzados antes de sus fases correspondientes.
- Portal de autoservicio para estudiantes, docentes o administrativos.
- Multiinstitución, múltiples sedes o catálogos independientes por unidad.
- Integración con inventario, directorio activo, correo o sistemas de facturación.
- Aplicación móvil nativa y notificaciones automáticas a las personas atendidas.

## Definiciones necesarias antes de implementar

Confirmar permisos entre técnicos, catálogo de categorías, campos adicionales, gestión de altas y bajas y política de correcciones. Antes de producción, acordar conservación de tickets y auditoría, tratamiento de datos personales, métricas de rendimiento, límites de costos y recuperación.

El detalle de persistencia, RLS e idempotencia está en [diseño de base de datos](database-design.md). Las pruebas que verifican estos requisitos están en [estrategia de pruebas](testing-strategy.md). Los costos y límites de IA se controlan según [costos y límites](costs-and-limits.md).
