# Supabase: migraciones y aprovisionamiento

Este directorio contiene la infraestructura de datos de TI SmartDesk AI: perfiles, catálogo de categorías, tickets, historial y las funciones RPC del ciclo de vida. La aplicación no ejecuta migraciones ni incluye claves administrativas.

## Archivos

```text
supabase/
  migrations/
    20261026120000_create_profiles.sql          Perfiles, trigger, is_admin() y RLS
    20261026130000_create_ticket_foundation.sql Helpers de personal, lectura de perfiles y catálogo
    20261026131000_create_tickets.sql           Tickets, historial, triggers, índices y RLS
    20261026132000_create_ticket_rpc.sql        RPC del ciclo de vida, esquema private e idempotencia
    20261028150000_create_public_incident_intake.sql Catálogos, campos públicos, RLS y RPC de alta web
  functions/
    registrar-incidencia-publica/index.ts       Puerta pública validada y limitada
  README.md                                     Este documento
```

No hay configuración de proyecto enlazado. La función Edge se versiona en este repositorio, pero la aplicación no ejecuta migraciones ni despliegues automáticamente.

## Orden de aplicación

Las migraciones son dependientes y deben aplicarse exactamente en este orden:

1. `20261026120000_create_profiles.sql`: requiere `auth.users` y crea `public.profiles`, su trigger, `is_admin()` y las políticas de lectura.
2. `20261026130000_create_ticket_foundation.sql`: requiere `profiles`; crea `is_active_staff()`, `is_active_technician()`, la política de lectura compartida de perfiles y `catalogo_categorias` con datos iniciales.
3. `20261026131000_create_tickets.sql`: requiere `profiles` y `catalogo_categorias`; crea la secuencia del número, `tickets`, `ticket_historial`, triggers, índices y RLS.
4. `20261026132000_create_ticket_rpc.sql`: requiere todo lo anterior; crea el esquema `private`, el núcleo de creación y las RPC públicas.
5. `20261028150000_create_public_incident_intake.sql`: agrega catálogos y campos públicos, admite el canal `web` y crea la RPC exclusiva de `service_role`.

## Formulario público

La ruta `/reportar` carga únicamente catálogos activos mediante SELECT anónimo. No tiene permisos de escritura. La función `registrar-incidencia-publica` valida el cuerpo, calcula un hash de la IP para el límite diario de 20 solicitudes y llama a `public.registrar_ticket_publico`, cuyo `EXECUTE` solo se concede a `service_role`. La RPC vuelve a validar docente, correo institucional, falla, tipo, área y relación pabellón/piso/ambiente antes de insertar el ticket en `nuevo` con canal `web`.

El evento inicial de un reporte externo conserva `actor_id = null`: no se inventa una identidad autenticada para una persona no registrada. Los eventos de atención posteriores siguen requiriendo el técnico autenticado y el historial mantiene su inmutabilidad.

### Despliegue de la función

Con la CLI enlazada explícitamente al proyecto correcto:

```text
supabase functions deploy registrar-incidencia-publica
supabase secrets set PUBLIC_FORM_ORIGIN=https://<dominio-publico>
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` son secretos gestionados por Supabase; no se colocan en React ni en el repositorio. En desarrollo, puede omitirse `PUBLIC_FORM_ORIGIN` para permitir el origen configurado por el entorno, pero en producción debe fijarse al dominio del formulario.

Aplicar una migración fuera de orden produce errores de referencia o de función inexistente. No se edita una migración ya aplicada: se corrige con una migración nueva.

## Variables del frontend

El frontend lee dos variables públicas desde `frontend/.env.local`:

```text
VITE_SUPABASE_URL=https://<proyecto>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<clave-publica>
```

- `VITE_SUPABASE_URL` es la URL del proyecto.
- `VITE_SUPABASE_PUBLISHABLE_KEY` es la clave publicable (o la clave `anon` heredada). Ambas están diseñadas para el navegador y quedan embebidas en el bundle.
- Nunca se usa `service_role`, una clave secreta (`sb_secret_...`) ni una contraseña en el frontend, el repositorio o los logs.
- `frontend/.env.example` no contiene credenciales y `frontend/.env.local` está ignorado por Git.
- Los valores se copian desde la configuración del proyecto en Supabase. No se documentan credenciales reales en este repositorio.

## Aplicar las migraciones

Las migraciones **no se aplican automáticamente** y este repositorio no está enlazado a ningún proyecto remoto. Aplicarlas en un proyecto remoto requiere autorización explícita y, cuando el cambio lo justifique, un respaldo previo.

### Opción A: editor SQL (sin CLI)

1. Abrir el proyecto correcto en Supabase y confirmar el entorno (desarrollo o producción).
2. Abrir **SQL Editor**.
3. Ejecutar los archivos completos en el orden indicado, uno por uno.
4. Revisar que el proyecto sea el esperado antes de cada ejecución.
5. Verificar el resultado con las consultas de comprobación de este documento.

Esta opción exige acceso administrativo al proyecto. El editor SQL se ejecuta con un rol de confianza y no debe usarse desde el navegador de la aplicación.

### Opción B: Supabase CLI (entorno local o proyecto enlazado)

Con la CLI instalada y el proyecto enlazado de forma explícita:

```text
supabase link --project-ref <project-ref>
supabase db push
```

Antes de ejecutar `db push`, confirmar el proyecto enlazado y aplicar las migraciones primero en local o en un entorno de prueba. No se debe ejecutar contra producción sin autorización ni respaldo cuando el cambio lo requiera.

## Configurar Auth del proyecto

Antes de crear cuentas, revisar la configuración de Auth del proyecto:

1. Abrir la configuración de proveedores de **Authentication** y localizar el proveedor **Email**.
2. Desactivar el registro público de usuarios (opción equivalente a *Allow new users to sign up* o *Enable sign ups*, según la versión del panel). La aplicación no muestra registro y el proyecto tampoco debe aceptar altas no autorizadas.
3. Mantener la confirmación de correo según la política institucional. Las cuentas creadas manualmente desde el panel pueden marcarse como confirmadas.
4. No habilitar proveedores sociales, enlaces mágicos ni inicio de sesión anónimo en esta fase sin una decisión registrada.

Aunque el registro estuviera habilitado por error, un usuario nuevo no tendría fila en `public.profiles` y RLS le negaría los datos; aun así, desactivarlo es la configuración esperada.

## Aprovisionar las cuentas iniciales

La aplicación **no tiene registro público** y no crea usuarios ni administradores automáticamente. El alta se realiza con un rol de confianza:

1. En Supabase, abrir **Authentication > Users** y crear cada una de las tres cuentas con el correo institucional.
2. Usar contraseñas temporales fuertes generadas con un gestor de contraseñas. No escribirlas en el repositorio, en este documento, en SQL ni en capturas.
3. Marcar el correo como confirmado al crear la cuenta (opción de auto confirmación del panel). Sin confirmación, el inicio de sesión puede ser rechazado por Auth.
4. Entregar la contraseña temporal por un canal seguro y solicitar su cambio según la política institucional. La interfaz de cambio de contraseña no forma parte de esta entrega.
5. Crear la fila correspondiente en `public.profiles` con el UUID de `auth.users`. Las tres cuentas operativas se crean con rol `tecnico` y `activo = true`; `admin` se asigna solo si la institución lo decide y lo registra.

Plantilla para el editor SQL. Sustituir los correos y nombres de ejemplo por los datos institucionales antes de ejecutar. Los correos `@ejemplo.test` son sintéticos y no deben usarse en producción.

```sql
insert into public.profiles (id, nombres, apellidos, rol, activo)
select
  u.id,
  datos.nombres,
  datos.apellidos,
  'tecnico',
  true
from auth.users u
join (
  values
    ('tecnico1@ejemplo.test', 'Nombres 1', 'Apellidos 1'),
    ('tecnico2@ejemplo.test', 'Nombres 2', 'Apellidos 2'),
    ('tecnico3@ejemplo.test', 'Nombres 3', 'Apellidos 3')
) as datos (email, nombres, apellidos)
  on datos.email = u.email
where not exists (
  select 1
  from public.profiles p
  where p.id = u.id
);
```

La tabla tiene `rol` con valores permitidos `admin` y `tecnico`, `activo` por defecto en `false`, longitudes acotadas y una clave foránea a `auth.users` con borrado en cascada.

### Asignar un administrador

Solo si la institución define quién administra los perfiles. El cambio se ejecuta de forma deliberada con un rol de confianza:

```sql
update public.profiles
set rol = 'admin'
where id = (
  select id
  from auth.users
  where email = 'correo-admin@ejemplo.test'
);
```

No se crea ningún administrador desde el frontend. El rol `admin` habilita la lectura de perfiles, catálogo, tickets e historial; no concede escritura ni permite ejecutar las transiciones de tickets. La gestión de cuentas sigue siendo una operación administrativa pendiente de decisión (DP-05).

## Catálogo de categorías

La migración `20261026130000_create_ticket_foundation.sql` inserta un catálogo provisional de solo lectura para el cliente: Hardware, Software, Redes y conectividad, Cuentas y accesos, Impresoras y Otros.

El mantenimiento se realiza con un rol de confianza y debe revisarse contra la decisión pendiente DP-01. No se elimina una categoría referenciada por tickets: la clave foránea usa `ON DELETE RESTRICT`. Para retirarla del uso, se desactiva:

```sql
update public.catalogo_categorias
set activo = false
where lower(btrim(nombre)) = lower('Hardware');
```

Una categoría inactiva conserva las referencias históricas pero la RPC de creación la rechaza con `categoria_inactiva`. El cliente autenticado solo puede leer el catálogo; no puede insertar, actualizar ni borrar.

## Operaciones de tickets

Toda escritura pasa por funciones RPC. El cliente autenticado no tiene `INSERT`, `UPDATE` ni `DELETE` sobre `tickets` ni sobre `ticket_historial`.

| RPC | Quién | Efecto |
| --- | --- | --- |
| `public.crear_ticket(...)` | Técnico activo | Crea el ticket en `nuevo`, sin técnico ni solución, con número e historial `creado`. |
| `public.tomar_ticket(id)` | Técnico activo | Asigna el técnico actual sin cambiar el estado. |
| `public.iniciar_atencion(id)` | Técnico asignado | Pasa a `en_atencion` y registra la fecha de inicio. |
| `public.resolver_ticket(id, solución)` | Técnico asignado | Exige solución, pasa a `resuelto` y registra la fecha. |
| `public.cerrar_ticket(id)` | Técnico asignado | Pasa a `cerrado` y registra la fecha de cierre. |
| `public.reabrir_ticket(id, motivo)` | Técnico activo | Vuelve a `reabierto`, quita la asignación, limpia fechas y conserva la solución previa como referencia y en el historial. |

Todas las funciones derivan el actor de `auth.uid()`, bloquean la fila antes de una transición y escriben el historial en la misma transacción. No aceptan un identificador de actor enviado por el cliente.

El esquema `private` contiene el núcleo `private.registrar_ticket` con actor explícito. Exige que el actor tenga perfil activo con rol `tecnico` y no está disponible para `anon` ni para `authenticated`; queda reservado a `service_role` como preparación para futuras integraciones de servidor. La interfaz no lo usa y no se implementan APIs externas todavía.

### Tokens de error

Las RPC lanzan un token estable en el mensaje; la interfaz lo traduce sin exponer detalles de PostgreSQL:

| Token | Situación |
| --- | --- |
| `no_autenticado` | No hay sesión válida. |
| `perfil_inactivo` | Perfil inexistente, inactivo o sin el rol requerido. |
| `datos_invalidos` | Campo ausente, longitud inválida o valor no permitido. |
| `categoria_inactiva` | La categoría no existe o fue desactivada. |
| `ticket_no_encontrado` | El ticket no existe o no es visible. |
| `transicion_invalida` | El estado no admite la operación. |
| `ticket_ya_tomado` | Otro técnico tomó el ticket antes. |
| `sin_asignacion` | La operación exige que el ticket esté asignado al técnico actual. |
| `solucion_requerida` | La resolución no incluye una solución válida. |
| `duplicate_request_conflict` | Se reutilizó la clave de idempotencia con contenido distinto. |
| `historial_inmutable` | Se intentó modificar o borrar un evento. |
| `ticket_no_eliminable` | Se intentó borrar un ticket. |
| `internal_error` | Fallo interno de consistencia; la interfaz muestra un error genérico. No debería ocurrir en operación normal. |

## Comprobaciones posteriores

Ejecutar en el editor SQL del proyecto, nunca desde el navegador de la aplicación:

```sql
-- Tablas del módulo y estado de RLS (todas deben tener relrowsecurity = true)
select c.relname, c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'profiles',
    'catalogo_categorias',
    'tickets',
    'ticket_historial'
  )
order by c.relname;

-- Políticas RLS: solo deben existir políticas de SELECT
select tablename, policyname, cmd, roles, qual
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- Funciones del módulo y sus permisos
select
  n.nspname as esquema,
  p.proname as funcion,
  pg_get_function_identity_arguments(p.oid) as argumentos,
  p.prosecdef as security_definer,
  p.proconfig as configuracion
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
  and p.proname in (
    'is_active_staff',
    'is_active_technician',
    'crear_ticket',
    'tomar_ticket',
    'iniciar_atencion',
    'resolver_ticket',
    'cerrar_ticket',
    'reabrir_ticket',
    'registrar_ticket'
  )
order by n.nspname, p.proname;

-- Estado de la secuencia del número público
select last_value, is_called from public.ticket_numero_seq;

-- Catálogo provisional
select nombre, activo
from public.catalogo_categorias
order by nombre;

-- Tickets recientes
select
  numero_ticket,
  estado,
  tecnico_asignado_id,
  fecha_creacion,
  fecha_inicio_atencion,
  fecha_resolucion,
  fecha_cierre
from public.tickets
order by fecha_creacion desc
limit 20;

-- Historial de un ticket (sustituir el UUID)
select
  h.creado_en,
  h.accion,
  h.estado_anterior,
  h.estado_nuevo,
  p.nombres,
  p.apellidos,
  h.detalle
from public.ticket_historial h
join public.profiles p on p.id = h.actor_id
where h.ticket_id = '<uuid-del-ticket>'
order by h.creado_en, h.id;

-- Claves de idempotencia duplicadas (debe devolver vacío)
select clave_idempotencia, count(*)
from public.tickets
where clave_idempotencia is not null
group by clave_idempotencia
having count(*) > 1;

-- Tickets que incumplen la coherencia esperada (debe devolver vacío)
select id, numero_ticket, estado
from public.tickets
where (estado in ('resuelto', 'cerrado') and solucion is null)
   or (estado in ('en_atencion', 'resuelto', 'cerrado') and tecnico_asignado_id is null);
```

Comprobaciones funcionales con cuentas sintéticas:

- Iniciar sesión con una cuenta activa debe mostrar el dashboard y la bandeja de tickets.
- Recargar la página debe conservar la sesión.
- Una cuenta sin fila en `profiles` o con `activo = false` debe ser rechazada y la sesión debe cerrarse.
- Un técnico activo puede leer todos los perfiles para mostrar la atribución, y solo puede operar tickets como técnico.
- Un administrador activo puede leer perfiles, catálogo, tickets e historial, pero no debe recibir acciones de transición ni poder ejecutar las RPC de operación.
- Un usuario anónimo no puede leer ninguna tabla del módulo ni invocar las RPC.
- Ningún usuario autenticado puede insertar, actualizar o borrar tickets o historial directamente mediante la API.
- Desde el cliente, cualquier `INSERT`, `UPDATE` o `DELETE` sobre tickets o historial falla por permisos. Desde un rol con privilegios DML, el trigger de tickets responde `ticket_no_eliminable` y el del historial `historial_inmutable`.
- Crear un ticket debe devolver estado `nuevo`, técnico nulo y solución nula.
- Un segundo técnico que intenta tomar el mismo ticket debe recibir `ticket_ya_tomado`.
- Resolver sin solución debe fallar con `solucion_requerida`.
- Reabrir un ticket cerrado debe devolverlo a la cola sin técnico, conservar la solución anterior como referencia y registrarla en el historial.
- Un ticket asignado a un técnico desactivado no puede ser operado por él (`perfil_inactivo`) ni tomado por otro (`ticket_ya_tomado`). La limitación está registrada en DP-09.

Estas comprobaciones no sustituyen la matriz negativa de [estrategia de pruebas](../docs/testing-strategy.md). RLS debe verificarse con sesiones reales o con un entorno local controlado; el editor SQL se ejecuta como propietario y omite RLS.

## Baja y desactivación

- **Desactivar:** `update public.profiles set activo = false where id = ...;`. La interfaz rechaza el acceso en el siguiente inicio de sesión o recarga. Si se requiere invalidar sesiones ya emitidas, usar la administración de Auth del proyecto.
- **Eliminar una cuenta sin actividad:** eliminar la cuenta en **Authentication > Users**. La clave foránea elimina el perfil asociado en cascada.
- **Eliminar una cuenta con actividad:** la operación falla porque `tickets.created_by`, `tickets.tecnico_asignado_id` y `ticket_historial.actor_id` usan `ON DELETE RESTRICT`. Es intencional para no perder la atribución histórica. En ese caso se desactiva el perfil y no se borra la cuenta.
- **Cambiar rol:** solo mediante una operación administrativa controlada y registrada fuera del cliente. Toda modificación de privilegios debe quedar documentada. Pasar un técnico a `admin` lo deja en solo lectura.
- **Técnico desactivado con tickets asignados:** no existe reasignación (DP-09). El técnico inactivo no puede operar y otro técnico no puede tomar un ticket que siga asignado; si está en `nuevo`, `reabierto` o `en_atencion`, queda bloqueado. Si está `resuelto` o `cerrado`, cualquier técnico activo puede reabrirlo y la asignación se limpia. No se corrige con `UPDATE` manual desde el cliente: la reasignación requiere una operación privilegiada revisada y una decisión registrada.

## Diagnóstico

| Síntoma | Causa probable | Acción |
| --- | --- | --- |
| Pantalla de configuración incompleta | Falta una variable `VITE_` o la URL no es válida. | Revisar `frontend/.env.local`, copiar desde `.env.example` y reiniciar Vite. |
| Credenciales rechazadas | Contraseña incorrecta, correo sin confirmar o cuenta inexistente. | Verificar la cuenta en Auth; no revelar si el correo existe en la interfaz. |
| Mensaje de perfil no autorizado | No existe fila en `profiles` o `activo = false`. | Aprovisionar o activar el perfil con un rol de confianza. |
| «El módulo de tickets no está disponible» | Las migraciones de tickets no se aplicaron en el proyecto. | Aplicar las migraciones en orden y recargar la aplicación. |
| La bandeja devuelve cero filas sin error | No hay tickets o el perfil no está activo. | Revisar `profiles.activo` y las políticas RLS; no desactivar RLS. |
| El catálogo aparece vacío | Migración de catálogo ausente o falta de perfil activo. | Aplicar `20261026130000` y revisar la política de lectura. |
| Error de columna o función inexistente | Migraciones aplicadas fuera de orden o incompletas. | Aplicar las migraciones faltantes en el orden documentado. |
| «Otro técnico tomó este ticket» | Toma simultánea detectada por el bloqueo de fila. | Actualizar la vista y continuar con otro ticket. |
| Un ticket asignado no ofrece acciones | El técnico asignado fue desactivado o ya no está disponible; no hay reasignación (DP-09). | Reabrir si está resuelto o cerrado; en otros estados, escalar la decisión DP-09 sin editar la asignación desde el cliente. |
| «La solución es obligatoria» | Intento de resolver con menos de 5 caracteres. | Escribir una solución válida antes de resolver. |
| Error de conexión | URL incorrecta, red o proyecto pausado. | Revisar la URL, la conectividad y el estado del proyecto. |

No se deben incluir claves, correos reales ni datos personales en reportes de errores o capturas.

## Referencias

- [Diseño de base de datos](../docs/database-design.md)
- [Reglas de negocio](../docs/business-rules.md)
- [Registro de decisiones](../docs/decisions.md)
- [Estrategia de pruebas](../docs/testing-strategy.md)
- [Instrucciones permanentes](../AGENTS.md)
