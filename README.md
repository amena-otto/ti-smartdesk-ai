# TI SmartDesk AI

Sistema web inteligente para registrar, gestionar y analizar tickets de soporte técnico en una institución educativa, con asistencia opcional de inteligencia artificial. El ticket se crea antes de atender la incidencia y recorre un ciclo de vida hasta su cierre.

## Tecnologías

- React + TypeScript + Vite y Tailwind CSS para la interfaz.
- Supabase PostgreSQL, Auth, RLS y funciones RPC para datos, autenticación y operaciones de servidor.
- Proveedor de inteligencia artificial intercambiable.
- pgvector en una fase posterior para recuperación de conocimiento.
- GitHub Actions para automatización y Cloudflare para publicación de la aplicación web.

## Estado

Proyecto en fase 1 en curso. Existen una base funcional de autenticación con Supabase Auth, perfiles con RLS y un módulo de tickets con bandeja, alta manual, detalle, historial y transiciones de estado. El código compila, pasa lint y 51 pruebas unitarias.

El módulo todavía no se ha verificado contra un proyecto Supabase real: las migraciones no se han aplicado y no hay pruebas de RLS ni de componentes en navegador. Tampoco hay chatbot, IA, reportes ni despliegue.

## Estructura del repositorio

```text
README.md          Presentación del proyecto y guía de lectura.
AGENTS.md          Instrucciones permanentes para agentes y colaboradores.
docs/              Arquitectura, requisitos, reglas, base de datos, IA, costos,
                   pruebas, flujo de trabajo y hoja de ruta.
frontend/          Aplicación React, TypeScript, Vite y Tailwind CSS.
supabase/          Migraciones SQL y guía de aprovisionamiento.
```

La estructura interna del frontend y el detalle de las migraciones están en [frontend/README.md](frontend/README.md) y [supabase/README.md](supabase/README.md).

## Puesta en marcha local

1. Aplicar las migraciones en orden y aprovisionar las cuentas según [supabase/README.md](supabase/README.md). No se ejecutan migraciones remotas de forma automática.
2. Instalar dependencias:

   ```text
   cd frontend
   npm install
   ```

3. Crear `frontend/.env.local` a partir de `frontend/.env.example` y completar solo los valores públicos del proyecto Supabase.
4. Iniciar el servidor de desarrollo:

   ```text
   npm run dev
   ```

Verificaciones disponibles en `frontend`: `npm run lint`, `npm run test` y `npm run build`. La autenticación y los tickets no se consideran verificados en remoto hasta probarlos contra un proyecto Supabase controlado.

## Propósito y usuarios

Tres técnicos de TI generalistas registran incidencias de estudiantes, docentes y administrativos. Los tickets se crean antes de la atención, se toman de una cola compartida, se inician, se resuelven con una solución, se cierran y pueden reabrirse.

Las incidencias pueden llegar presencialmente o mediante el número institucional compartido de WhatsApp Business. La primera versión no integra directamente WhatsApp: el canal se registra como dato y el texto se aporta manualmente.

## Principios del proyecto

- El ticket se crea antes de atender la incidencia; la solución se registra al resolverlo.
- El registro y las transiciones manuales funcionan sin IA.
- PostgreSQL genera el número único del ticket y la sesión autenticada determina al técnico que lo toma.
- Solo un técnico activo opera tickets; el rol `admin` activo solo consulta.
- La solución es obligatoria para resolver y cada transición queda en un historial inmutable.
- No se borran tickets físicamente ni se edita el historial desde el cliente.
- La IA propone una clasificación y un borrador editable; el técnico confirma antes de guardar.
- El acceso a datos se controla con RLS y la IA no tiene acceso administrativo directo a la base de datos.

## Documentación

| Documento | Contenido |
| --- | --- |
| [Arquitectura](docs/architecture.md) | Componentes, responsabilidades, seguridad y flujos de datos. |
| [Requisitos](docs/requirements.md) | Requisitos funcionales y no funcionales verificables. |
| [Reglas de negocio](docs/business-rules.md) | Restricciones del dominio y controles esperados. |
| [Diseño de base de datos](docs/database-design.md) | Tablas, restricciones, RLS, historial e idempotencia. |
| [Hoja de ruta](docs/roadmap.md) | Fases, entregables y criterios de aceptación. |
| [Diseño de IA](docs/ai-design.md) | Interpretación, clasificación, borrador, validación y confirmación. |
| [Flujo de trabajo](docs/github-workflow.md) | Ramas, Pull Requests, CI, despliegue y reversión. |
| [Estrategia de pruebas](docs/testing-strategy.md) | Niveles, matriz de riesgos y evaluación de IA. |
| [Costos y límites](docs/costs-and-limits.md) | Consumo, controles de gasto y riesgos de proveedores. |
| [Decisiones](docs/decisions.md) | Registro de decisiones de arquitectura y pendientes. |
| [Operación de Supabase](supabase/README.md) | Migraciones, variables públicas y aprovisionamiento de cuentas. |

Las instrucciones permanentes para agentes y colaboradores están en [AGENTS.md](AGENTS.md).

Lectura sugerida: reglas de negocio y requisitos para entender el alcance; arquitectura, base de datos y diseño de IA para las decisiones técnicas; flujo de trabajo, pruebas y costos para implementar; hoja de ruta para el orden.

## Alcance actual y próximos pasos

Esta etapa implementa autenticación, perfiles, catálogo provisional de categorías, tickets, historial y las operaciones de toma, inicio, resolución, cierre y reapertura. No incluye chatbot, IA, reportes, voz ni despliegue.

La verificación contra un proyecto Supabase real, la aplicación de las migraciones y la creación de las cuentas son pasos manuales pendientes. Antes de completar la fase 1 se deben acordar el catálogo definitivo de categorías, la política de correcciones, el formato definitivo del número y la zona horaria, y el responsable institucional del alta de técnicos.

## Decisiones pendientes

| Tema | Documento | Fase que la requiere |
| --- | --- | --- |
| Catálogo definitivo de categorías y su mantenimiento | [Reglas de negocio](docs/business-rules.md) | 1 |
| Corrección de campos ya guardados sin reescribir el historial | [Base de datos](docs/database-design.md) | 1 |
| Formato del número, zona horaria y fechas retrospectivas | [Decisiones](docs/decisions.md) | 1 |
| Alta y baja de técnicos y gestión de permisos | [Decisiones](docs/decisions.md) | 1 |
| Proveedor de IA, presupuesto y tratamiento de datos | [Costos y límites](docs/costs-and-limits.md) | 2 |
| Corpus de conocimiento y política de acceso | [Hoja de ruta](docs/roadmap.md) | 4 |
| Conservación de datos, respaldo y RPO/RTO | [Base de datos](docs/database-design.md) | 6 |
