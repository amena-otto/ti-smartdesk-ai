# Hoja de ruta

> La operación compartida y el reporte de eficiencia del Área TI se encuentran
> implementados mediante la migración `20261029100000_shared_admin_ticket_operations.sql`.

Las fases expresan dependencias y resultados verificables, sin fechas comprometidas. Una fase se acepta al demostrar sus criterios; la presencia de documentación no implica una función implementada.

| Fase | Objetivo | Depende de | Resultado verificable |
| --- | --- | --- | --- |
| 0 | Preparación y arquitectura | — | Documentación coherente y decisiones pendientes identificadas. |
| 1 | Base de datos, autenticación y tickets manuales | Decisiones de dominio de la fase 0 | Los tres técnicos registran, toman, atienden, resuelven y cierran tickets sin IA. |
| 2 | Chatbot, clasificación y confirmación | Registro manual estable y proveedor elegido | Borrador editable con confirmación explícita. |
| 3 | Agente con herramientas seguras | Contratos de IA estables y permisos aprobados | Herramientas acotadas sin acceso administrativo. |
| 4 | Base de conocimientos y RAG | Corpus aprobado y política de acceso | Respuestas con fuentes y permisos respetados. |
| 5 | Analítica, voz y reportes | Calidad de datos e indicadores acordados | Indicadores y reportes confiables. |
| 6 | Estabilización y despliegue | Alcance de versión y políticas operativas | Publicación verificada y operación documentada. |

## Fase 0. Preparación y arquitectura

**Entregables:** README actualizado; arquitectura, requisitos, reglas de negocio, diseño de base de datos, diseño de IA, flujo de trabajo, estrategia de pruebas, costos y límites, registro de decisiones y esta hoja de ruta; `AGENTS.md` con instrucciones permanentes.

**Criterios de aceptación:**

- Los documentos cubren las diecinueve reglas de negocio y distinguen alcance inicial de ampliaciones.
- Se explican límites de confianza, responsabilidades, flujos manual y asistido, persistencia y auditoría.
- Los requisitos tienen identificadores y criterios verificables, con trazabilidad a reglas y fases.
- Las decisiones sin confirmar están identificadas y no se presentan como requisitos aprobados.
- Los enlaces internos son válidos y los diagramas Mermaid describen componentes, datos y estados.
- El repositorio conserva su README y no incorpora dependencias ni código de aplicación en esta fase.

## Fase 1. Base de datos, autenticación y tickets manuales

**Dependencias:** confirmar el catálogo definitivo de categorías, el formato del número y la zona horaria, y el responsable institucional del alta de técnicos.

**Entregables:** aplicación React, TypeScript, Vite y Tailwind CSS; migraciones PostgreSQL conforme al [diseño de base de datos](database-design.md); Auth; RLS; perfiles; catálogo de categorías; bandeja con filtros; formulario manual; detalle e historial; acciones de tomar, iniciar, resolver, cerrar y reabrir; generación del número; idempotencia; pruebas de integración; verificaciones iniciales en GitHub Actions según el [flujo de trabajo](github-workflow.md).

**Estado parcial:** autenticación, perfiles, catálogo provisional, tickets, historial y RPC están implementados en código, con 51 pruebas unitarias y build correcto. Faltan la aplicación real de las migraciones, la verificación de RLS contra un proyecto Supabase controlado, las pruebas de componentes y end-to-end, y los workflows de CI.

**Criterios de aceptación:**

- Los tres técnicos acceden con cuentas individuales y registran tickets antes de atender la incidencia, sin IA.
- El ticket nace en estado `nuevo`, sin técnico asignado y sin solución.
- PostgreSQL genera números únicos, incluidos registros concurrentes; el técnico asignado se obtiene de la sesión al tomar el ticket.
- Solo un técnico activo toma, inicia, resuelve, cierra o reabre; el rol `admin` activo solo consulta.
- La solución es obligatoria para resolver y cada transición se registra en un historial cronológico e inmutable.
- Dos técnicos no pueden tomar el mismo ticket a la vez.
- Las pruebas de RLS comprueban acceso anónimo, lectura compartida del personal activo y operaciones entre técnicos.
- Ticket e historial se confirman o revierten juntos; los técnicos no alteran ni borran el historial.
- Los reintentos no duplican tickets y los errores de guardado se muestran sin perder innecesariamente el formulario.
- No existe borrado físico de tickets.
- La corrección de campos ya guardados queda fuera de esta fase hasta que se decida su alcance.

## Fase 2. Chatbot, clasificación y confirmación

**Dependencias:** creación manual estable y elección de proveedor con política de datos y límites de consumo.

**Entregables:** Edge Function autenticada, adaptador de IA, contrato estructurado, clasificación con catálogo, vista previa editable, confirmación explícita y límites de tamaño, frecuencia y presupuesto conforme a [costos y límites](costs-and-limits.md).

**Criterios de aceptación:**

- El texto produce un borrador validado y distingue datos faltantes o ambiguos.
- No se guarda ningún ticket al conversar, generar, editar o cancelar; solo al confirmar la versión revisada.
- El guardado reutiliza las validaciones y auditoría de fase 1.
- Caídas, respuestas inválidas y tiempos de espera de IA permiten continuar manualmente.
- Las claves no llegan al navegador ni al modelo; se verifican límites de tamaño, frecuencia y tiempo.
- Un conjunto acordado de ejemplos evalúa clasificación y extracción; el umbral de calidad se define antes de aceptar la fase.

## Fase 3. Agente de IA con herramientas seguras

**Dependencias:** contratos y evaluación del chatbot estables; aprobación del catálogo de herramientas y permisos.

**Entregables:** herramientas limitadas para consultar categorías, buscar tickets autorizados y preparar borradores; límites de ejecución y trazabilidad de invocaciones.

**Criterios de aceptación:**

- Cada herramienta valida sesión, autorización, argumentos y límites en servidor.
- El agente no ejecuta SQL arbitrario ni obtiene acceso administrativo a PostgreSQL.
- Las consultas respetan RLS o un control equivalente expresamente diseñado y verificado.
- Una solicitud maliciosa en el texto no modifica permisos ni activa escrituras sin confirmación.
- Si se expone una operación de creación, exige la confirmación vinculada al borrador vigente y conserva los controles de fase 1.

## Fase 4. Base de conocimientos y RAG

**Dependencias:** corpus aprobado, responsables de contenido y política de acceso y privacidad.

**Entregables:** documentos de conocimiento, segmentación, embeddings y pgvector; recuperación autorizada; respuestas con fuentes; proceso de actualización del corpus.

**Criterios de aceptación:**

- La recuperación no expone documentos fuera de los permisos del técnico.
- Las respuestas identifican fuentes y comunican insuficiencia de evidencia.
- Un conjunto de consultas de referencia permite evaluar relevancia, fidelidad y ausencia de filtraciones.
- Los documentos retirados o actualizados dejan de recuperarse conforme a una política definida.
- Las sugerencias para resolver un problema no crean tickets ni ejecutan transiciones hasta que el técnico las revise y confirme.

## Fase 5. Analítica, voz y reportes

**Dependencias:** calidad de datos suficiente, indicadores acordados y política para audio y exportaciones.

**Entregables:** indicadores por fecha, categoría y tipo de persona; reportes autorizados; captura de voz con transcripción editable.

**Criterios de aceptación:**

- Las cifras coinciden con consultas de referencia y especifican filtros y período.
- Los indicadores describen el ciclo de los tickets y sus tiempos; no se infieren datos que las fechas registradas no sustenten.
- Los reportes respetan permisos y minimizan datos personales.
- El técnico revisa la transcripción y confirma antes de crear un ticket; el modo manual continúa disponible.
- Se aprueba la política de conservación de audio antes de habilitar su captura.

## Fase 6. Estabilización y despliegue

**Dependencias:** alcance de la versión acordado y políticas operativas aprobadas. Las pruebas y controles básicos comienzan en fases anteriores.

**Entregables:** revisión de seguridad y accesibilidad; pruebas integrales según la [estrategia de pruebas](testing-strategy.md); publicación en Cloudflare; automatización con GitHub Actions conforme al [flujo de trabajo](github-workflow.md); configuración de producción Supabase; revisión de consumo y límites; monitoreo; manual de operación, respaldo, restauración y reversión.

**Criterios de aceptación:**

- El alta manual y el ciclo de vida pasan pruebas completas, incluyendo sesión vencida, toma simultánea, transición inválida, caída de IA, errores de red y confirmaciones repetidas.
- No hay secretos de servidor en artefactos públicos; se verifican políticas RLS y auditoría en el entorno objetivo.
- Se comprueban rendimiento y accesibilidad contra los objetivos acordados.
- Se demuestra restauración y reversión; se documentan RPO, RTO y responsables de operación.
- Los tres técnicos validan el uso cotidiano y disponen de una guía breve.

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación prevista |
| --- | --- | --- |
| Dependencia del proveedor de IA o cambios de precio. | El asistente deja de ser viable. | Adaptador intercambiable y registro manual independiente. |
| Envío de datos personales innecesarios al proveedor. | Exposición de información de la comunidad educativa. | Minimización en servidor, revisión de la política de datos y logs sin texto completo. |
| RLS incompleta o permisos entre técnicos mal definidos. | Acceso a tickets ajenos o transiciones no autorizadas. | Pruebas negativas por rol, revisión antes de producción y políticas explícitas. |
| Duplicados por reintentos o doble confirmación. | Reportes y conteos incorrectos. | Idempotencia en servidor, restricciones de unicidad y pruebas de concurrencia. |
| Categorías ambiguas o catálogo inestable. | Clasificación inconsistente y analítica poco fiable. | Catálogo acotado con descripciones, revisión periódica y evaluación de ejemplos; el catálogo actual es provisional. |
| Concentración de conocimiento en un solo técnico. | Dificultad para operar y mantener el sistema. | Documentación, revisiones cruzadas y transferencia de conocimiento. |
| Ampliación de alcance hacia WhatsApp o agentes autónomos. | Retrasos y riesgos de seguridad. | Fases con criterios de aceptación y revisión explícita de requisitos. |
| Pérdida de borradores no persistidos. | Retrabajo del técnico. | Comunicar la limitación y evaluar persistencia con política de conservación. |
| Datos históricos con fechas o zonas horarias inconsistentes. | Reportes sesgados. | Definir zona horaria y reglas de fechas retrospectivas antes de la fase 1. |

## Decisiones transversales

Mantener las decisiones pendientes en los documentos correspondientes y resolverlas antes de la fase que dependa de ellas. Las fases no autorizan por sí mismas integrar WhatsApp ni eliminar la confirmación humana. Cualquier ampliación requiere revisar requisitos, riesgos y criterios de aceptación.
