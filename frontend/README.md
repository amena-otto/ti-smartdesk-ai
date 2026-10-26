# Frontend de TI SmartDesk AI

Aplicación web en React, TypeScript, Vite y Tailwind CSS para gestionar tickets de soporte TI. Incluye autenticación, panel inicial, bandeja de tickets, alta manual, detalle, historial y acciones del ciclo de vida. Todavía no incluye chatbot, IA, reportes ni voz.

## Requisitos

- Node.js 24 o compatible con las versiones fijadas en `package.json`.
- Una cuenta de Supabase con el proyecto configurado y las migraciones aplicadas en orden. Ver [`supabase/README.md`](../supabase/README.md).

## Configuración

1. Instalar dependencias desde esta carpeta:

   ```text
   npm install
   ```

2. Crear `.env.local` a partir de `.env.example`:

   ```text
   VITE_SUPABASE_URL=https://<proyecto>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<clave-publica>
   ```

3. Usar solo la URL y la clave publicable (o `anon`). Nunca `service_role`, `sb_secret_...` ni contraseñas. La aplicación rechaza una clave que parezca privilegiada.

## Comandos

```text
npm run dev        Servidor de desarrollo de Vite
npm run build      Verificación de TypeScript y build de producción
npm run lint       ESLint
npm run test       Pruebas con Vitest
npm run preview    Vista previa del build
```

## Estructura

```text
src/
  components/          Guards, layout y estados de pantalla
  domain/               Tipos, validaciones, permisos y parseo de perfiles y tickets
  features/auth/        Contexto, proveedor, hook y servicio de autenticación
  features/tickets/     Servicio RPC, errores y componentes de tickets
  lib/                  Configuración de entorno y cliente de Supabase
  pages/                Login, panel, bandeja, alta, detalle, configuración y 404
```

Las validaciones reutilizables viven en `src/domain` y se aplican también en PostgreSQL. `features/tickets` no decide permisos por sí solo: calcula qué acciones mostrar y la base de datos vuelve a autorizar cada operación.

## Rutas

| Ruta | Acceso | Contenido |
| --- | --- | --- |
| `/login` | Solo sin sesión | Inicio de sesión. |
| `/dashboard` | Sesión con perfil activo | Panel, datos del perfil y accesos. |
| `/tickets` | Sesión con perfil activo | Bandeja, filtros por estado y categoría. |
| `/tickets/nuevo` | Solo técnico activo | Alta manual de un ticket en estado `nuevo`. |
| `/tickets/:ticketId` | Sesión con perfil activo | Detalle, historial y acciones según rol y estado. |

## Comportamiento de autenticación

- Inicio de sesión con correo y contraseña mediante Supabase Auth.
- Sesión persistente y restaurada al recargar.
- Cierre de sesión local aunque el servidor no responda.
- Un perfil inexistente o inactivo se rechaza y la sesión se cierra.
- No existe registro público ni creación automática de administradores.
- El rol mostrado proviene de `public.profiles`; nunca de un valor enviado por el navegador.
- Las rutas privadas se protegen con React Router y el estado de autenticación.

## Comportamiento de tickets

- La bandeja lista tickets con filtros por estado y categoría y muestra estados de carga, error y reintento.
- El alta manual crea el ticket en `nuevo`, sin técnico y sin solución. Envía una clave de idempotencia por intento.
- El detalle muestra datos, fechas del ciclo, solución previa cuando aplica e historial cronológico.
- Acciones disponibles:
  - **Tomar:** asigna el ticket al técnico actual sin cambiar el estado.
  - **Iniciar atención:** solo para el técnico asignado; pasa a `en_atencion`.
  - **Resolver:** exige una solución y solo la ejecuta el técnico asignado.
  - **Cerrar:** solo desde `resuelto` y con confirmación.
  - **Reabrir:** desde `resuelto` o `cerrado`; el ticket vuelve a la cola sin técnico.
- Un perfil `admin` ve los tickets en modo lectura y no recibe acciones de transición.
- Los errores de las RPC se traducen a mensajes accionables sin exponer detalles de PostgreSQL.

## Seguridad

- RLS permite la lectura compartida de perfiles, categorías, tickets e historial al personal activo.
- El cliente no tiene permisos de escritura sobre perfiles, categorías, tickets ni historial.
- Las transiciones pasan por RPC que derivan el actor de la sesión y validan el estado y la asignación.
- El número, las fechas del ciclo y el historial los genera el servidor.
- Los errores mostrados son mensajes genéricos y no incluyen detalles internos ni valores de configuración.
- `frontend/.env.local` está ignorado por Git y no debe compartirse.

## Verificación pendiente

El build y las pruebas unitarias locales no demuestran que la autenticación, las RPC o RLS funcionen contra un proyecto Supabase real. Esa comprobación requiere aplicar las migraciones y aprovisionar cuentas en un entorno controlado, además de ejecutar la matriz negativa de [estrategia de pruebas](../docs/testing-strategy.md).
