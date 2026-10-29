# Reglas de negocio

> **Modelo vigente:** los tickets pertenecen al Área TI y no requieren toma ni
> asignación individual. Cualquier cuenta `admin` activa puede iniciar,
> continuar, resolver, cerrar o reabrir cualquier ticket. La columna
> `tecnico_asignado_id` se conserva solo por compatibilidad histórica. Las RPC
> derivan el actor desde `auth.uid()` y los reportes usan `America/Lima`.

## Reglas confirmadas

| ID | Regla | Control esperado |
| --- | --- | --- |
| RN-01 | Los tickets se crean antes de atender la incidencia y describen el problema reportado. | El formulario crea el ticket en estado `nuevo`, sin solución y sin técnico asignado. Una atención no se registra como resuelta al crearse. |
| RN-02 | Cada ticket tiene un número único generado por PostgreSQL. | Generación atómica y restricción de unicidad en la base; el navegador y la IA no eligen el número. |
| RN-03 | Se registran asunto, descripción, categoría, nombre y tipo de solicitante y canal de origen. | Validación de campos obligatorios y referencias tanto en interfaz como en servidor. La ubicación es opcional. |
| RN-04 | El técnico asignado se deriva de la sesión autenticada en el momento de tomar el ticket. | La operación de toma usa `auth.uid()` y rechaza cualquier identificador de técnico enviado por el cliente. |
| RN-05 | La ubicación es opcional y pertenece al ticket, no a la persona. | Se almacena en el ticket y puede omitirse; no modifica un perfil de la persona. |
| RN-06 | El registro manual siempre debe funcionar sin IA. | La creación, consulta y transiciones manuales no requieren llamadas, claves ni resultados del proveedor de IA. |
| RN-07 | El chatbot interpreta texto, propone clasificación y muestra una vista previa editable. | La propuesta es un borrador; campos faltantes y dudas quedan visibles. |
| RN-08 | Ningún ticket se guarda desde el chatbot sin confirmación del técnico. | Solo una acción explícita de confirmar registro inicia la creación; conversación, generación y edición no guardan. |
| RN-09 | La IA no tiene acceso directo administrativo a la base de datos. | Acceso mediante herramientas de servidor limitadas y autorizadas, sin secretos administrativos en el contexto del modelo. |
| RN-10 | Toda transición relevante queda registrada en un historial inmutable. | Creación, toma, inicio, resolución, cierre y reapertura registran actor, fecha, estado anterior, estado nuevo y detalle cuando corresponda, en la misma transacción. |
| RN-11 | No se integra directamente WhatsApp en la primera versión. | No hay conexión automática, webhooks ni envío o lectura de mensajes desde la aplicación. |
| RN-12 | La IA no inventa datos faltantes. | Los campos no inferibles quedan vacíos o pendientes; la propuesta distingue información ausente y no completa persona, fechas, solución ni ubicación sin evidencia. |
| RN-13 | El ciclo de vida es `nuevo` → `en_atencion` → `resuelto` → `cerrado`; un ticket resuelto o cerrado puede pasar a `reabierto`. | PostgreSQL restringe los estados y las transiciones permitidas; una transición inválida se rechaza con un mensaje comprensible. |
| RN-14 | Solo un técnico con perfil activo puede crear, tomar, iniciar, resolver, cerrar o reabrir. El rol `admin` solo consulta. | Las funciones RPC exigen `rol = 'tecnico'` y `activo = true`; RLS permite lectura compartida al personal activo. |
| RN-15 | La solución es obligatoria para resolver y solo la registra el técnico asignado. | Restricción `CHECK` y validación en la operación de resolución; sin solución válida el estado no cambia. |
| RN-16 | No se elimina físicamente un ticket ni se modifica su historial. | Triggers de protección y ausencia de políticas y permisos de `DELETE`/`UPDATE` para el cliente. |
| RN-17 | Dos técnicos no pueden tomar el mismo ticket a la vez. | La fila se bloquea durante la toma; el segundo intento recibe `ticket_ya_tomado` y debe actualizar la vista. |
| RN-18 | Un reintento de creación no duplica el ticket. | Clave de idempotencia única y huella del contenido; el mismo contenido devuelve el ticket previo y un contenido distinto se rechaza. |
| RN-19 | La reapertura devuelve el ticket a la cola y conserva la solución anterior en el historial. | La reapertura limpia la asignación y las fechas del ciclo, pero no borra el registro histórico de la solución. |

## Definiciones del dominio

- **Ticket:** registro de una incidencia de soporte TI. Nace en estado `nuevo` antes de ser atendido y recorre un ciclo de vida hasta `cerrado`. No es un perfil permanente de la persona.
- **Cola:** conjunto de tickets en estado `nuevo` o `reabierto` que todavía no tienen técnico asignado o esperan una nueva atención.
- **Toma:** asignación del ticket al técnico autenticado sin cambiar todavía el estado.
- **Inicio de atención:** transición a `en_atencion`; registra la fecha de inicio. Requiere que el ticket esté asignado al técnico que la ejecuta.
- **Resolución:** transición a `resuelto` con una solución obligatoria.
- **Cierre:** confirmación final del ticket resuelto; registra la fecha de cierre.
- **Reapertura:** transición de `resuelto` o `cerrado` a `reabierto`; el ticket vuelve a la cola sin técnico asignado.
- **Técnico:** uno de los tres operadores generalistas con sesión autenticada y perfil activo; no se exige una especialidad.
- **Administrador:** perfil con rol `admin` y `activo = true`. Consulta tickets y perfiles; no ejecuta transiciones de tickets desde el cliente.
- **Solicitante:** estudiante, docente o administrativo. Su nombre no es una clave única. El **tipo de solicitante** se limita a los tres valores.
- **Ubicación:** contexto de un ticket concreto, por ejemplo un aula u oficina; no es un atributo permanente de la persona.
- **Borrador:** propuesta editable que todavía no es un ticket. Su generación no asigna número definitivo.
- **Confirmación:** acción explícita del técnico sobre la versión revisada del borrador para solicitar su registro.
- **Historial:** secuencia cronológica e inmutable de transiciones del ticket, con actor y detalle acotado.

## Consecuencias para la implementación

La creación no exige técnico asignado: primero se registra la incidencia y después un técnico la toma. La toma y el inicio son acciones separadas para que el equipo pueda reservar trabajo antes de comenzar la atención.

La clasificación de IA debe utilizar el catálogo vigente. Si falta información o el texto es ambiguo, el chatbot pide aclaración o deja el campo pendiente; no inventa una solución, persona ni fecha. La confirmación no elimina las validaciones: al guardar se comprueban nuevamente identidad, permisos, obligatoriedad, referencias e integridad.

La creación del ticket y su primer evento de historial son atómicos. Cada transición actualiza el ticket y agrega el evento correspondiente en la misma transacción. No se registra un cambio exitoso si falla el historial.

La auditoría de dominio es el historial de tickets. Los errores y accesos denegados pueden registrarse por separado como eventos de seguridad, sin convertirlos en transiciones.

RN-06 elimina la dependencia de IA; no implica operación sin conexión ni disponibilidad si Auth o PostgreSQL están caídos. Un fallo debe comunicarse sin presentar un cambio inexistente como guardado.

## Escenarios límite

| Escenario | Comportamiento esperado | Reglas |
| --- | --- | --- |
| Se registra una incidencia todavía no atendida. | Se crea un ticket en estado `nuevo`, sin técnico y sin solución. | RN-01, RN-13 |
| Dos técnicos intentan tomar el mismo ticket. | Solo uno lo consigue; el otro recibe un aviso y actualiza la vista. | RN-17 |
| Un técnico intenta iniciar un ticket que no ha tomado. | La operación se rechaza por falta de asignación. | RN-04, RN-14 |
| Se intenta resolver sin escribir una solución. | La operación se rechaza; el estado no cambia. | RN-15 |
| Un técnico distinto del asignado intenta resolver o cerrar. | La operación se rechaza; solo el asignado puede hacerlo. | RN-14, RN-15 |
| Un administrador intenta tomar o resolver un ticket. | La interfaz no ofrece la acción y la función RPC la rechaza. | RN-14 |
| El ticket se reabre después de cerrado. | Vuelve a `reabierto`, sin técnico y a la cola; la solución anterior permanece en el historial. | RN-10, RN-13, RN-19 |
| La misma persona es atendida varias veces. | Se crean tickets independientes; el nombre no identifica unívocamente a la persona. | RN-02, RN-03 |
| Un docente cambia de oficina. | La ubicación se guarda en cada ticket; no se actualiza ningún perfil permanente. | RN-05 |
| El chatbot afirma que el caso está resuelto. | La afirmación no basta: el técnico debe verificarlo y confirmar el borrador. | RN-07, RN-08 |
| Se pulsa confirmar dos veces o se reintenta tras perder la respuesta. | Se devuelve el mismo ticket; no se crea un duplicado. | RN-18 |
| La categoría se desactiva entre la propuesta y la confirmación. | El guardado se rechaza y se solicita elegir una categoría vigente. | RN-03, RN-07 |
| El proveedor de IA está caído o responde mal. | Se continúa con el registro manual; no se pierde el trabajo ya escrito. | RN-06, RN-07 |
| Se intenta asignar otro técnico desde el navegador. | El servidor ignora el valor y usa la sesión autenticada, o rechaza la operación. | RN-04 |
| Se intenta borrar un ticket o editar su historial. | La base lo impide; la corrección se hará con una transición auditada cuando se defina. | RN-10, RN-16 |
| Se copia al chatbot una conversación con datos de terceros. | Se registra solo lo necesario y se evita conservar el texto completo por defecto. | RN-09, RN-10 |

## Aplicación por fase

| Regla | Fase en que se hace efectiva |
| --- | --- |
| RN-01 a RN-06 | Fase 1, con el registro manual y el ciclo de vida. |
| RN-07 y RN-08 | Fase 2, con el chatbot, la vista previa y la confirmación. |
| RN-09 | Fase 2, con las Edge Functions; se refuerza en fase 3 con herramientas acotadas. |
| RN-10 | Fase 1 en creación y transiciones; se amplía en cada fase con nuevas operaciones. |
| RN-11 | Todas las fases de la primera versión; solo se revisaría en una ampliación explícita. |
| RN-12 | Fase 2, con la validación del borrador; se mantiene en toda herramienta de IA posterior. |
| RN-13 a RN-19 | Fase 1, con el ciclo de vida implementado en PostgreSQL y la interfaz de tickets. |

## Políticas pendientes de aprobación

- Quién revisa el historial y con qué periodicidad. La lectura ya está compartida entre el personal activo.
- Cómo corregir errores de un ticket ya guardado (categoría, solicitante, descripción o solución) sin reescribir el historial. No se habilita `UPDATE` libre.
- Categorías iniciales definitivas y responsable de su mantenimiento; el catálogo actual es provisional.
- Formato definitivo del número de ticket, zona horaria institucional y reglas para fechas retrospectivas.
- Conservación, eliminación o anonimización de datos personales e historial; retención de borradores si posteriormente se decide persistirlos.
- Cómo reasignar un ticket cuyo técnico asignado fue desactivado; hoy queda bloqueado para el resto del equipo (DP-09).

Estas políticas no sustituyen ni flexibilizan las reglas confirmadas.

Los controles técnicos de cada regla se detallan en [diseño de base de datos](database-design.md); la verificación esperada, en [estrategia de pruebas](testing-strategy.md).
