# Registro de decisiones

## Cómo usar este documento

Cada decisión relevante del proyecto se registra aquí con un identificador estable. Una decisión aceptada no se reescribe: si cambia, se marca como reemplazada y se crea una nueva. Los identificadores `DA-xx` coinciden con los usados en [arquitectura](architecture.md).

Estados posibles:

- **Aceptada:** guía la implementación actual.
- **Propuesta:** dirección recomendada, pendiente de validación antes de la fase que la requiere.
- **Pendiente:** requiere una decisión explícita; bloquea la fase indicada.
- **Reemplazada:** sustituida por otra decisión, que se referencia.

## Decisiones registradas

| ID | Decisión | Estado | Motivo y consecuencia |
| --- | --- | --- | --- |
| DA-01 | Supabase reúne Auth, PostgreSQL, RLS y Edge Functions. | Aceptada | Definido por el stack. Reduce operación para un equipo de tres personas y mantiene identidad y datos en un mismo perímetro. |
| DA-02 | La creación de tickets ocurre mediante una operación controlada en base de datos, no con DML directo del cliente. | Aceptada | Permite derivar el creador, generar el número y auditar sin confiar en el navegador. Ver [diseño de base de datos](database-design.md). |
| DA-03 | El número público se genera con una secuencia atómica y restricción de unicidad. | Aceptada | Cumple RN-02 y admite concurrencia. Los saltos de secuencia son aceptables. |
| DA-04 | La IA se consume mediante un adaptador con contrato estructurado propio. | Aceptada | Cumple RNF-04 y evita acoplar el dominio a un proveedor. |
| DA-05 | Los borradores del chatbot viven en memoria de la interfaz durante la fase 2. | Propuesta | Evita persistir conversaciones sin política de conservación. Consecuencia: recargar la página pierde el borrador. |
| DA-06 | Cloudflare publica solo artefactos estáticos. | Propuesta | Mantiene secretos y lógica de dominio fuera del borde. Requiere configurar variables públicas solo para URL y clave publicable de Supabase. |
| DA-07 | El historial se escribe en PostgreSQL dentro de la transacción de la operación. | Aceptada | El cliente no puede omitirlo y un fallo revierte el cambio (RN-10). |
| DA-08 | La escritura de tickets se expone con funciones RPC `security definer`, con `search_path` fijado, sin SQL dinámico y sin DML directo para el cliente. | Aceptada | Concentra validación, número, idempotencia e historial en un único punto. Exige pruebas negativas por ser código privilegiado. |
| DA-09 | La idempotencia usaba `client_request_id` único por técnico más una huella del contenido. | Reemplazada por DA-25 | El modelo de tickets cambió a una clave global única con verificación de actor y huella. |
| DA-10 | `attention_date` se almacenaba como `date` y `created_at` como `timestamptz`. | Reemplazada por DA-24 | El ticket ahora tiene un ciclo con varias fechas técnicas y no una única fecha de atención. |
| DA-11 | Las categorías se guardan en una tabla con vigencia, no en un tipo enumerado. | Aceptada | Permite mantener el catálogo sin migración estructural y conservar referencias históricas. |
| DA-12 | No se crea un maestro de personas ni un perfil permanente de docente. | Aceptada | La ubicación y los datos de contacto pertenecen a cada ticket (RN-05). Los nombres pueden repetirse. |
| DA-13 | Visibilidad de tickets entre los tres técnicos. | Reemplazada por DA-23 | La visibilidad compartida se resolvió al implementar RLS. |
| DA-14 | WhatsApp se usa como contexto manual, sin integración técnica en la primera versión. | Aceptada | Cumple RN-11. El canal se registra como dato, sin webhooks ni credenciales del servicio. |
| DA-15 | No se incorpora un ORM adicional; se usa el cliente de Supabase con tipos generados. | Propuesta | Evita una capa innecesaria para un dominio pequeño. El SQL vive en migraciones y funciones revisadas. |
| DA-16 | No se persisten conversaciones ni transcripciones del chatbot por defecto. | Propuesta | Minimiza datos personales y costo de almacenamiento. El historial conserva la operación, no el diálogo. |
| DA-17 | Organización del código por `features` y `domain`, con la interfaz separada de las reglas. | Aceptada | Facilita reutilizar validaciones y probar sin UI. Implementado para autenticación y tickets. |
| DA-18 | Entornos local y producción al inicio; staging solo si una necesidad concreta lo justifica. | Propuesta | Evita sobreingeniería. Las migraciones y pruebas destructivas se validan en local. |
| DA-19 | Los perfiles operativos viven en `public.profiles`, 1:1 con `auth.users`, con roles `admin` y `tecnico` y RLS de solo lectura para el cliente. | Aceptada | Reemplaza el nombre conceptual `technician_profiles`. El navegador no puede escribir perfiles ni autoasignarse privilegios. |
| DA-20 | Las cuentas y los perfiles se aprovisionan manualmente con un rol de confianza; no hay registro público ni alta automática de administradores. | Aceptada | Reduce la superficie de ataque y evita crear privilegios por defecto. Requiere un responsable institucional (DP-05). |
| DA-21 | El frontend usa solo la URL y la clave publicable o `anon` de Supabase, validadas al iniciar. | Aceptada | Las claves públicas quedan en el bundle, por lo que la autorización depende de RLS. Se rechaza una configuración que parezca `service_role` o una clave secreta. |
| DA-22 | El ticket recorre los estados `nuevo`, `en_atencion`, `resuelto`, `cerrado` y `reabierto`; la toma y el inicio son operaciones separadas. | Aceptada | Permite reservar trabajo antes de iniciar la atención y auditar cada paso por separado. |
| DA-23 | El personal activo (`admin` y `tecnico`) comparte la lectura de tickets, categorías, perfiles e historial; solo un técnico activo ejecuta transiciones. | Aceptada | El servicio es un mostrador común. El rol administrativo queda en supervisión de solo lectura. |
| DA-24 | El ticket usa `fecha_creacion`, `fecha_inicio_atencion`, `fecha_resolucion` y `fecha_cierre` como `timestamptz` del servidor. | Aceptada | Modela el ciclo real, permite medir tiempos y evita una fecha de atención separada. |
| DA-25 | La idempotencia usa `clave_idempotencia` única y `huella_contenido`; un reintento idéntico devuelve el ticket y uno con contenido distinto se rechaza. | Aceptada | Cumple RNF-11 y prepara futuras integraciones. La clave es global y se valida junto con el actor. |
| DA-26 | El número visible se compone como `TS-` más una secuencia de 6 dígitos. | Aceptada como formato provisional | Cumple RN-02 y es legible. El formato definitivo, la zona horaria y las fechas retrospectivas se confirman en DP-04. |
| DA-27 | El catálogo inicial de categorías es provisional y de solo lectura para el cliente. | Aceptada como provisional | Permite operar en fase 1 sin bloquear el alta de tickets. El mantenimiento y la lista definitiva siguen en DP-01. |
| DA-28 | El historial específico `ticket_historial` sustituye a una tabla genérica `audit_events` en la fase 1. | Aceptada | Cubre creación y transiciones con menos superficie. Se ampliará si aparecen operaciones administrativas auditables. |
| DA-29 | La reapertura devuelve el ticket a la cola sin técnico, limpia las fechas del ciclo y conserva la solución anterior en el historial. | Aceptada | Evita reutilizar una solución obsoleta y mantiene trazabilidad para la nueva atención. |
| DA-30 | Las integraciones externas usarán `private.registrar_ticket` con actor explícito; no se expone al cliente y no se implementan APIs externas todavía. | Aceptada como preparación | Permite incorporar canales sin sesión de técnico con permisos mínimos y sin abrir escritura directa. |

## Decisiones pendientes

| ID | Tema | Fase | Impacto si no se resuelve |
| --- | --- | --- | --- |
| DP-01 | Catálogo definitivo de categorías y responsable de su mantenimiento. | 1 | El catálogo provisional permite operar, pero la clasificación y la analítica pueden volverse inconsistentes. |
| DP-02 | Corrección de campos ya guardados (categoría, solicitante, descripción o solución) sin reescribir el historial. | 1 | Los errores solo pueden corregirse con una operación nueva; falta definir el alcance y la autorización. La visibilidad quedó resuelta por DA-23. |
| DP-03 | Campos obligatorios del ticket. | Resuelta | Las migraciones y RPC fijan asunto, descripción, categoría, solicitante, tipo y canal; la ubicación es opcional y la solución es obligatoria al resolver. |
| DP-04 | Formato definitivo del número, zona horaria institucional y fechas retrospectivas. | 1 | Riesgo de inconsistencias en reportes; el formato actual es provisional (DA-26). |
| DP-05 | Alta, baja y cambios de rol de técnicos: responsable institucional y política aplicable. | 1 | El procedimiento técnico existe, pero no se puede operar con cuentas reales sin designar quién autoriza los cambios. |
| DP-06 | Proveedor de IA, presupuesto y tratamiento de datos. | 2 | Bloquea el chatbot y los límites de costo. |
| DP-07 | Política de conservación, respaldo y RPO/RTO. | 6 | Riesgo de pérdida de datos y de incumplimiento. |
| DP-08 | Corpus de conocimiento y política de acceso. | 4 | Bloquea RAG y su evaluación. |
| DP-09 | Reasignación de tickets cuando el técnico asignado se desactiva o deja de estar disponible. | 1 | Un ticket asignado a un técnico inactivo queda bloqueado: el técnico no puede operar por `perfil_inactivo` y otro técnico no puede tomarlo por `ticket_ya_tomado`. Solo se libera mediante una operación privilegiada revisada o, si ya estaba resuelto o cerrado, con una reapertura. |

## Plantilla para nuevas decisiones

```text
ID:            DA-xx
Título:        Decisión en una frase
Estado:        Aceptada | Propuesta | Pendiente | Reemplazada
Contexto:      Problema o restricción que la motiva
Decisión:      Qué se hará y qué no se hará
Consecuencias: Efectos positivos, costos, riesgos y deuda asumida
Referencias:   Requisitos, reglas o documentos relacionados
```

## Criterios para decidir

- Priorizar la solución más simple que cumpla las reglas de negocio y los requisitos verificables.
- No añadir servicios, capas ni dependencias sin una necesidad concreta y documentada.
- Toda decisión que afecte seguridad, datos personales o costos requiere revisión explícita antes de producción.
- Una decisión pendiente no se convierte en requisito por omisión: debe aprobarse y registrarse.
