# TI SmartDesk AI

Sistema web inteligente para registrar, gestionar y analizar atenciones de soporte técnico solucionadas en una institución educativa, con asistencia opcional de inteligencia artificial.

## Tecnologías
- React + TypeScript + Vite y Tailwind CSS para la interfaz.
- Supabase PostgreSQL, Auth, RLS y Edge Functions para datos, autenticación y operaciones de servidor.
- Proveedor de inteligencia artificial intercambiable.
- pgvector en una fase posterior para recuperación de conocimiento.
- GitHub Actions para automatización y Cloudflare para publicación de la aplicación web.

## Estado
Proyecto en fase 0: preparación y arquitectura. El repositorio contiene documentación; todavía no incluye aplicación, esquema de base de datos ni configuración de despliegue.

## Estructura del repositorio

```text
README.md          Presentación del proyecto y guía de lectura.
AGENTS.md          Instrucciones permanentes para agentes y colaboradores.
docs/              Arquitectura, requisitos, reglas, base de datos, IA, costos,
                   pruebas, flujo de trabajo y hoja de ruta.
```

La estructura de código se incorporará en la fase 1 y está propuesta en [arquitectura](docs/architecture.md).

## Propósito y usuarios

Tres técnicos de TI generalistas registrarán y consultarán las atenciones resueltas de estudiantes, docentes y administrativos. Las atenciones pueden ocurrir presencialmente o mediante el número institucional compartido de WhatsApp Business.

La primera versión no integrará directamente WhatsApp. El técnico podrá registrar manualmente lo atendido o aportar texto al chatbot, evitando información personal innecesaria.

## Principios del proyecto

- Solo se registran atenciones ya solucionadas; no se gestiona un ciclo de tickets abiertos.
- El registro manual funciona sin IA.
- PostgreSQL genera el código único del ticket y la sesión autenticada determina al técnico responsable.
- La IA propone una clasificación y un borrador editable; el técnico confirma antes de guardar.
- Las modificaciones relevantes quedan auditadas y el acceso a datos se controla con RLS.
- La IA accede a capacidades limitadas mediante el servidor, sin acceso administrativo directo a la base de datos.

## Documentación

| Documento | Contenido |
| --- | --- |
| [Arquitectura](docs/architecture.md) | Componentes, responsabilidades, seguridad y flujos de datos. |
| [Requisitos](docs/requirements.md) | Requisitos funcionales y no funcionales verificables. |
| [Reglas de negocio](docs/business-rules.md) | Restricciones del dominio y controles esperados. |
| [Diseño de base de datos](docs/database-design.md) | Tablas, restricciones, RLS, auditoría e idempotencia. |
| [Hoja de ruta](docs/roadmap.md) | Fases, entregables y criterios de aceptación. |
| [Diseño de IA](docs/ai-design.md) | Interpretación, clasificación, borrador, validación y confirmación. |
| [Flujo de trabajo](docs/github-workflow.md) | Ramas, Pull Requests, CI, despliegue y reversión. |
| [Estrategia de pruebas](docs/testing-strategy.md) | Niveles, matriz de riesgos y evaluación de IA. |
| [Costos y límites](docs/costs-and-limits.md) | Consumo, controles de gasto y riesgos de proveedores. |
| [Decisiones](docs/decisions.md) | Registro de decisiones de arquitectura y pendientes. |

Las instrucciones permanentes para agentes y colaboradores están en [AGENTS.md](AGENTS.md).

Lectura sugerida: reglas de negocio y requisitos para entender el alcance; arquitectura, base de datos y diseño de IA para las decisiones técnicas; flujo de trabajo, pruebas y costos para implementar; hoja de ruta para el orden.

## Alcance actual y próximos pasos

Esta etapa define la solución y sus criterios de aceptación. No requiere instalar dependencias ni configurar servicios. Las propuestas técnicas no representan funcionalidades implementadas.

Antes de implementar se deben acordar el catálogo de categorías, la visibilidad y edición entre técnicos, los campos obligatorios del detalle de atención y la política de conservación de datos. Estas decisiones se recogen en la documentación.

## Decisiones pendientes

| Tema | Documento | Fase que la requiere |
| --- | --- | --- |
| Catálogo inicial de categorías y su mantenimiento | [Reglas de negocio](docs/business-rules.md) | 1 |
| Visibilidad, edición y corrección entre técnicos | [Base de datos](docs/database-design.md) | 1 |
| Campos obligatorios, formato de código y fechas retrospectivas | [Requisitos](docs/requirements.md) | 1 |
| Alta y baja de técnicos y gestión de permisos | [Decisiones](docs/decisions.md) | 1 |
| Proveedor de IA, presupuesto y tratamiento de datos | [Costos y límites](docs/costs-and-limits.md) | 2 |
| Corpus de conocimiento y política de acceso | [Hoja de ruta](docs/roadmap.md) | 4 |
| Conservación de datos, respaldo y RPO/RTO | [Base de datos](docs/database-design.md) | 6 |
