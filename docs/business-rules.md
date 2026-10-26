# Reglas de negocio

## Reglas confirmadas

| ID | Regla | Control esperado |
| --- | --- | --- |
| RN-01 | Solo se registran atenciones ya solucionadas. | El formulario y la confirmación expresan esta condición. Una consulta sobre un problema pendiente no produce un ticket. |
| RN-02 | Cada ticket tiene un código único generado por PostgreSQL. | Generación atómica y restricción de unicidad en la base; el navegador y la IA no eligen el código. |
| RN-03 | Se registran categoría, nombre y tipo de persona atendida, técnico responsable y fecha. | Validación de campos obligatorios y referencias tanto en interfaz como en servidor. |
| RN-04 | El técnico responsable se obtiene de la sesión autenticada. | El servidor deriva la identidad y evita suplantación mediante campos manipulados. |
| RN-05 | La ubicación es opcional y no se asocia permanentemente al docente. | Se almacena en la atención y puede omitirse; no modifica un perfil de la persona. |
| RN-06 | El registro manual siempre debe funcionar sin IA. | La creación y consulta manuales no requieren llamadas, claves ni resultados del proveedor de IA. |
| RN-07 | El chatbot interpreta texto, propone clasificación y muestra una vista previa editable. | La propuesta es un borrador; campos faltantes y dudas quedan visibles. |
| RN-08 | Ningún ticket se guarda desde el chatbot sin confirmación del técnico. | Solo una acción explícita de confirmar registro inicia la creación; conversación, generación y edición no guardan. |
| RN-09 | La IA no tiene acceso directo administrativo a la base de datos. | Acceso mediante herramientas de servidor limitadas y autorizadas, sin secretos administrativos en el contexto del modelo. |
| RN-10 | Toda modificación relevante debe quedar auditada. | Creación, cambios de datos y futuras anulaciones generan eventos protegidos, junto con la operación de dominio. |
| RN-11 | No se integra directamente WhatsApp en la primera versión. | No hay conexión automática, webhooks ni envío o lectura de mensajes desde la aplicación. |
| RN-12 | La IA no inventa datos faltantes. | Los campos no inferibles quedan vacíos o pendientes; la propuesta distingue información ausente y no completa persona, fecha, solución ni ubicación sin evidencia. |

## Definiciones del dominio

- **Ticket:** registro histórico de una atención solucionada. No representa una solicitud pendiente de resolución.
- **Técnico:** uno de los tres operadores generalistas con sesión autenticada; no se exige una especialidad.
- **Persona atendida:** estudiante, docente o administrativo. Su nombre no es una clave única. El **tipo de solicitante** es esa misma clasificación y se limita a los tres valores.
- **Fecha de atención:** fecha del servicio realizado. Se distingue de la fecha técnica de creación del registro.
- **Ubicación:** contexto de una atención concreta, por ejemplo un aula u oficina; no es un atributo permanente de la persona.
- **Borrador:** propuesta editable que todavía no es un ticket. Su generación no asigna código definitivo.
- **Confirmación:** acción explícita del técnico sobre la versión revisada del borrador para solicitar su registro.
- **Modificación relevante:** cambio persistente que afecta trazabilidad o significado del registro, incluyendo categoría, persona, fecha, ubicación, descripción y solución cuando estos campos existan. También incluye cambios de permisos o catálogos que se habiliten.

## Consecuencias para la implementación

La clasificación de IA debe utilizar el catálogo vigente. Si falta información o el texto es ambiguo, el chatbot pide aclaración o deja el campo pendiente; no inventa una solución, persona ni fecha. El técnico debe verificar que la atención esté resuelta.

La confirmación no elimina las validaciones: al guardar se comprueban nuevamente identidad, permisos, obligatoriedad, referencias e integridad. La creación y su evento de auditoría deben ser atómicos. No se registra una creación exitosa si la transacción falla.

La auditoría de operaciones confirmadas es diferente del registro de errores o intentos denegados. Los eventos de seguridad pueden registrarse por separado sin convertirlos en modificaciones de tickets.

RN-06 elimina la dependencia de IA; no implica operación sin conexión ni disponibilidad si Auth o PostgreSQL están caídos. Un fallo debe comunicarse sin presentar un registro inexistente como guardado.

## Escenarios límite

| Escenario | Comportamiento esperado | Reglas |
| --- | --- | --- |
| Se consulta un problema que aún no se resuelve. | No se registra la atención; se indica que el ticket se crea al solucionarlo. | RN-01 |
| La misma persona es atendida varias veces. | Se crean tickets independientes; el nombre no identifica unívocamente a la persona. | RN-02, RN-03 |
| Un docente cambia de oficina. | La ubicación se guarda en cada atención; no se actualiza ningún perfil permanente. | RN-05 |
| El chatbot afirma que el caso está resuelto. | La afirmación no basta: el técnico debe verificarlo y confirmar el borrador. | RN-07, RN-08 |
| Se pulsa confirmar dos veces o se reintenta tras perder la respuesta. | Se devuelve el mismo ticket; no se crea un duplicado. | RN-02, RN-08 |
| La categoría se desactiva entre la propuesta y la confirmación. | El guardado se rechaza y se solicita elegir una categoría vigente. | RN-03, RN-07 |
| El proveedor de IA está caído o responde mal. | Se continúa con el registro manual; no se pierde el trabajo ya escrito. | RN-06, RN-07 |
| Se intenta asignar otro técnico responsable desde el navegador. | El servidor ignora el valor y usa la sesión autenticada, o rechaza la operación. | RN-04 |
| Se corrige un ticket ya guardado. | El cambio queda auditado; no se elimina físicamente el registro. | RN-10 |
| Se copia al chatbot una conversación con datos de terceros. | Se registra solo lo necesario y se evita conservar el texto completo por defecto. | RN-09, RN-10 |

## Aplicación por fase

| Regla | Fase en que se hace efectiva |
| --- | --- |
| RN-01 a RN-06 | Fase 1, con el registro manual. |
| RN-07 y RN-08 | Fase 2, con el chatbot, la vista previa y la confirmación. |
| RN-09 | Fase 2, con las Edge Functions; se refuerza en fase 3 con herramientas acotadas. |
| RN-10 | Fase 1 en creación y edición; se amplía en cada fase con nuevas operaciones. |
| RN-11 | Todas las fases de la primera versión; solo se revisaría en una ampliación explícita. |
| RN-12 | Fase 2, con la validación del borrador; se mantiene en toda herramienta de IA posterior. |

## Políticas pendientes de aprobación

- Quién puede consultar o modificar atenciones de otro técnico y quién revisa la auditoría.
- Cómo corregir errores, gestionar una anulación y autorizar excepcionalmente una corrección del responsable. No se habilita reasignación libre por defecto.
- Categorías iniciales, mantenimiento del catálogo y tratamiento de categorías desactivadas.
- Obligatoriedad de descripción, solución y canal; formato del código y reglas para fechas retrospectivas.
- Conservación, eliminación o anonimización de datos personales y auditoría, y retención de borradores si posteriormente se decide persistirlos.

Estas políticas no sustituyen ni flexibilizan las doce reglas confirmadas.

Los controles técnicos de cada regla se detallan en [diseño de base de datos](database-design.md); la verificación esperada, en [estrategia de pruebas](testing-strategy.md).
