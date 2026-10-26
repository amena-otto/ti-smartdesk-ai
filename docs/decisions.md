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
| DA-02 | La creación de tickets ocurre mediante una operación controlada en base de datos, no con DML directo del cliente. | Aceptada | Permite derivar el responsable, generar el código y auditar sin confiar en el navegador. Ver [diseño de base de datos](database-design.md). |
| DA-03 | El código público se genera con una secuencia atómica y restricción de unicidad. | Aceptada | Cumple RN-02 y admite concurrencia. Los saltos de secuencia son aceptables. |
| DA-04 | La IA se consume mediante un adaptador con contrato estructurado propio. | Aceptada | Cumple RNF-04 y evita acoplar el dominio a un proveedor. |
| DA-05 | Los borradores del chatbot viven en memoria de la interfaz durante la fase 2. | Propuesta | Evita persistir conversaciones sin política de conservación. Consecuencia: recargar la página pierde el borrador. |
| DA-06 | Cloudflare publica solo artefactos estáticos. | Propuesta | Mantiene secretos y lógica de dominio fuera del borde. Requiere configurar variables públicas solo para URL y clave anónima de Supabase. |
| DA-07 | La auditoría se escribe en PostgreSQL dentro de la transacción de la operación. | Aceptada | El cliente no puede omitirla y un fallo revierte el cambio (RN-10). |
| DA-08 | La escritura de tickets se expone con una función RPC `security definer`, con `search_path` fijado, sin SQL dinámico y sin DML directo para el cliente. | Propuesta | Concentra validación, código, idempotencia y auditoría en un único punto. Exige revisión de seguridad y pruebas negativas por ser código privilegiado. |
| DA-09 | La idempotencia usa `client_request_id` único por técnico más una huella del contenido. | Aceptada | Cumple RNF-11. Un reintento devuelve el ticket previo; reutilizar el identificador con otros datos se rechaza. |
| DA-10 | `attention_date` se almacena como `date` y `created_at` como `timestamptz`. | Propuesta | Separa la fecha del servicio de la fecha técnica. Falta fijar la zona horaria institucional y las reglas de fechas retrospectivas. |
| DA-11 | Las categorías se guardan en una tabla con vigencia, no en un tipo enumerado. | Propuesta | Permite mantener el catálogo sin migración estructural y conservar referencias históricas. |
| DA-12 | No se crea un maestro de personas ni un perfil permanente de docente. | Aceptada | La ubicación y los datos de contacto pertenecen a cada atención (RN-05). Los nombres pueden repetirse. |
| DA-13 | Visibilidad de tickets entre los tres técnicos. | Pendiente | Se propone lectura compartida por tratarse de un mostrador común. La alternativa es acceso solo a lo propio. Afecta RLS, consultas y reportes. |
| DA-14 | WhatsApp se usa como contexto manual, sin integración técnica en la primera versión. | Aceptada | Cumple RN-11. El canal se registra como dato, sin webhooks ni credenciales del servicio. |
| DA-15 | No se incorpora un ORM adicional; se usa el cliente de Supabase con tipos generados. | Propuesta | Evita una capa innecesaria para un dominio pequeño. El SQL vive en migraciones y funciones revisadas. |
| DA-16 | No se persisten conversaciones ni transcripciones del chatbot por defecto. | Propuesta | Minimiza datos personales y costo de almacenamiento. La auditoría conserva la operación, no el diálogo. |
| DA-17 | Organización del código por `features` y `domain`, con la interfaz separada de las reglas. | Propuesta | Facilita reutilizar validaciones y probar sin UI. Se concreta en la fase 1. |
| DA-18 | Entornos local y producción al inicio; staging solo si una necesidad concreta lo justifica. | Propuesta | Evita sobreingeniería. Las migraciones y pruebas destructivas se validan en local. |

## Decisiones pendientes

| ID | Tema | Fase | Impacto si no se resuelve |
| --- | --- | --- | --- |
| DP-01 | Catálogo inicial de categorías y responsable de su mantenimiento. | 1 | No se puede clasificar ni validar la IA. |
| DP-02 | Visibilidad, edición y corrección de tickets entre técnicos. | 1 | RLS y consultas quedan indefinidas. |
| DP-03 | Campos obligatorios: descripción, solución, ubicación, canal. | 1 | El esquema y los formularios no son verificables. |
| DP-04 | Formato del código, zona horaria y fechas retrospectivas. | 1 | Riesgo de inconsistencias en reportes. |
| DP-05 | Alta y baja de técnicos y gestión de permisos. | 1 | No se puede operar con cuentas reales. |
| DP-06 | Proveedor de IA, presupuesto y tratamiento de datos. | 2 | Bloquea el chatbot y los límites de costo. |
| DP-07 | Política de conservación, respaldo y RPO/RTO. | 6 | Riesgo de pérdida de datos y de incumplimiento. |
| DP-08 | Corpus de conocimiento y política de acceso. | 4 | Bloquea RAG y su evaluación. |

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
