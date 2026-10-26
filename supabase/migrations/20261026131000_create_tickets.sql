-- Tablas, restricciones, historial y RLS del módulo de tickets
--
-- Los tickets se crean antes de atender la incidencia. La escritura no se
-- concede al cliente: se realiza mediante las funciones RPC de la migración
-- siguiente. El historial es de solo adición.

-- Número público generado por PostgreSQL. La secuencia puede tener saltos por
-- transacciones revertidas; el número no promete continuidad.
create sequence if not exists public.ticket_numero_seq
  as bigint
  start with 1
  increment by 1
  cache 1;

revoke all on sequence public.ticket_numero_seq from public;
revoke all on sequence public.ticket_numero_seq from anon;
revoke all on sequence public.ticket_numero_seq from authenticated;
grant usage on sequence public.ticket_numero_seq to service_role;

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  numero_ticket text not null
    default ('TS-' || lpad(nextval('public.ticket_numero_seq')::text, 6, '0')),
  asunto text not null,
  descripcion text not null,
  categoria_id uuid not null,
  solicitante_nombre text not null,
  solicitante_tipo text not null,
  ubicacion text,
  canal_origen text not null default 'manual',
  estado text not null default 'nuevo',
  tecnico_asignado_id uuid,
  solucion text,
  fecha_creacion timestamptz not null default now(),
  fecha_inicio_atencion timestamptz,
  fecha_resolucion timestamptz,
  fecha_cierre timestamptz,
  -- Opcional para futuras integraciones autorizadas. En la creación desde la
  -- interfaz se deriva del actor autenticado.
  created_by uuid,
  -- Preparación de idempotencia para futuras fuentes externas. La interfaz ya
  -- envía una clave por intento de creación.
  clave_idempotencia text,
  huella_contenido text,
  actualizado_en timestamptz not null default now(),
  constraint tickets_numero_ticket_key unique (numero_ticket),
  constraint tickets_clave_idempotencia_key unique (clave_idempotencia),
  constraint tickets_categoria_id_fkey
    foreign key (categoria_id)
    references public.catalogo_categorias (id)
    on delete restrict,
  constraint tickets_tecnico_asignado_id_fkey
    foreign key (tecnico_asignado_id)
    references public.profiles (id)
    on delete restrict,
  constraint tickets_created_by_fkey
    foreign key (created_by)
    references public.profiles (id)
    on delete restrict,
  constraint tickets_numero_ticket_formato
    check (numero_ticket ~ '^TS-[0-9]{6,}$'),
  constraint tickets_asunto_longitud
    check (char_length(btrim(asunto)) between 3 and 150),
  constraint tickets_descripcion_longitud
    check (char_length(btrim(descripcion)) between 5 and 4000),
  constraint tickets_solicitante_nombre_longitud
    check (char_length(btrim(solicitante_nombre)) between 2 and 150),
  constraint tickets_solicitante_tipo_valido
    check (solicitante_tipo in ('estudiante', 'docente', 'administrativo')),
  constraint tickets_ubicacion_longitud
    check (ubicacion is null or char_length(ubicacion) <= 200),
  constraint tickets_canal_origen_valido
    check (canal_origen in ('manual', 'ia', 'whatsapp', 'correo')),
  constraint tickets_estado_valido
    check (estado in ('nuevo', 'en_atencion', 'resuelto', 'cerrado', 'reabierto')),
  constraint tickets_solucion_longitud
    check (
      solucion is null
      or char_length(btrim(solucion)) between 5 and 4000
    ),
  constraint tickets_solucion_requerida
    check (
      estado not in ('resuelto', 'cerrado')
      or (solucion is not null and char_length(btrim(solucion)) >= 5)
    ),
  constraint tickets_tecnico_requerido
    check (
      estado in ('nuevo', 'reabierto')
      or tecnico_asignado_id is not null
    ),
  constraint tickets_en_atencion_completo
    check (
      estado <> 'en_atencion'
      or (tecnico_asignado_id is not null and fecha_inicio_atencion is not null)
    ),
  constraint tickets_resuelto_completo
    check (
      estado <> 'resuelto'
      or (
        tecnico_asignado_id is not null
        and fecha_resolucion is not null
        and solucion is not null
      )
    ),
  constraint tickets_cerrado_completo
    check (
      estado <> 'cerrado'
      or (
        tecnico_asignado_id is not null
        and fecha_resolucion is not null
        and fecha_cierre is not null
        and solucion is not null
      )
    ),
  constraint tickets_fechas_coherentes
    check (
      (fecha_inicio_atencion is null or fecha_inicio_atencion >= fecha_creacion)
      and (fecha_resolucion is null or fecha_resolucion >= fecha_creacion)
      and (
        fecha_resolucion is null
        or fecha_inicio_atencion is null
        or fecha_resolucion >= fecha_inicio_atencion
      )
      and (
        fecha_cierre is null
        or (fecha_resolucion is not null and fecha_cierre >= fecha_resolucion)
      )
    ),
  constraint tickets_clave_idempotencia_longitud
    check (clave_idempotencia is null or char_length(clave_idempotencia) between 1 and 200),
  constraint tickets_huella_contenido_longitud
    check (huella_contenido is null or char_length(huella_contenido) = 32)
);

comment on table public.tickets is
  'Tickets de soporte creados antes de la atención. Sin DML directo desde el cliente.';
comment on column public.tickets.numero_ticket is
  'Número público único generado por PostgreSQL. No lo elige el cliente ni la IA.';
comment on column public.tickets.estado is
  'Ciclo de vida: nuevo, en_atencion, resuelto, cerrado o reabierto.';
comment on column public.tickets.tecnico_asignado_id is
  'Técnico que tomó el ticket. Nulo mientras no exista asignación.';
comment on column public.tickets.created_by is
  'Actor que creó el ticket. Nulo solo en una integración autorizada que no lo informe; el perfil referenciado no se puede eliminar mientras exista el ticket.';
comment on column public.tickets.clave_idempotencia is
  'Clave de reintento para evitar duplicados desde la interfaz o futuras integraciones.';
comment on column public.tickets.huella_contenido is
  'Huella del contenido para detectar la reutilización de una clave con datos distintos.';

create index if not exists tickets_estado_fecha_creacion_idx
  on public.tickets (estado, fecha_creacion desc);
create index if not exists tickets_categoria_fecha_creacion_idx
  on public.tickets (categoria_id, fecha_creacion desc);
create index if not exists tickets_tecnico_fecha_creacion_idx
  on public.tickets (tecnico_asignado_id, fecha_creacion desc);
create index if not exists tickets_fecha_creacion_idx
  on public.tickets (fecha_creacion desc);

-- Historial cronológico de transiciones. Solo se escribe desde las funciones
-- RPC. El navegador no puede insertar, modificar ni eliminar filas.
create table if not exists public.ticket_historial (
  id bigint generated always as identity primary key,
  ticket_id uuid not null,
  accion text not null,
  estado_anterior text,
  estado_nuevo text not null,
  actor_id uuid not null,
  detalle text,
  creado_en timestamptz not null default now(),
  constraint ticket_historial_ticket_id_fkey
    foreign key (ticket_id)
    references public.tickets (id)
    on delete restrict,
  constraint ticket_historial_actor_id_fkey
    foreign key (actor_id)
    references public.profiles (id)
    on delete restrict,
  constraint ticket_historial_accion_valida
    check (accion in ('creado', 'tomado', 'iniciado', 'resuelto', 'cerrado', 'reabierto')),
  constraint ticket_historial_estado_anterior_valido
    check (
      estado_anterior is null
      or estado_anterior in ('nuevo', 'en_atencion', 'resuelto', 'cerrado', 'reabierto')
    ),
  constraint ticket_historial_estado_nuevo_valido
    check (estado_nuevo in ('nuevo', 'en_atencion', 'resuelto', 'cerrado', 'reabierto')),
  constraint ticket_historial_detalle_longitud
    check (detalle is null or char_length(detalle) <= 4000)
);

comment on table public.ticket_historial is
  'Historial de solo adición de las transiciones de un ticket.';
comment on column public.ticket_historial.actor_id is
  'Perfil que ejecutó la transición. Nunca lo elige el navegador.';
comment on column public.ticket_historial.detalle is
  'Solución registrada, motivo de reapertura u otra nota acotada.';

create index if not exists ticket_historial_ticket_id_creado_en_idx
  on public.ticket_historial (ticket_id, creado_en, id);

-- El historial es inmutable incluso para roles de aplicación.
create or replace function public.protect_ticket_historial()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using
    errcode = 'P0001',
    message = 'historial_inmutable';
end;
$$;

revoke all on function public.protect_ticket_historial() from public;

drop trigger if exists ticket_historial_protect on public.ticket_historial;
create trigger ticket_historial_protect
before update or delete on public.ticket_historial
for each row
execute function public.protect_ticket_historial();

-- No se permite borrado físico de tickets mediante operaciones normales.
create or replace function public.protect_tickets_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using
    errcode = 'P0001',
    message = 'ticket_no_eliminable';
end;
$$;

revoke all on function public.protect_tickets_delete() from public;

drop trigger if exists tickets_protect_delete on public.tickets;
create trigger tickets_protect_delete
before delete on public.tickets
for each row
execute function public.protect_tickets_delete();

drop trigger if exists tickets_set_actualizado_en on public.tickets;
create trigger tickets_set_actualizado_en
before update on public.tickets
for each row
execute function public.set_actualizado_en();

alter table public.tickets enable row level security;
alter table public.ticket_historial enable row level security;

drop policy if exists "tickets_select_staff" on public.tickets;
create policy "tickets_select_staff"
on public.tickets
for select
to authenticated
using ((select public.is_active_staff()));

drop policy if exists "ticket_historial_select_staff" on public.ticket_historial;
create policy "ticket_historial_select_staff"
on public.ticket_historial
for select
to authenticated
using ((select public.is_active_staff()));

-- Lectura compartida para el mostrador común. El rol admin puede supervisar,
-- pero las funciones RPC de operación exigen rol tecnico activo.
revoke all on table public.tickets from public;
revoke all on table public.tickets from anon;
revoke all on table public.tickets from authenticated;
grant select on table public.tickets to authenticated;

revoke all on table public.ticket_historial from public;
revoke all on table public.ticket_historial from anon;
revoke all on table public.ticket_historial from authenticated;
grant select on table public.ticket_historial to authenticated;

-- Sin políticas de INSERT, UPDATE ni DELETE: toda escritura pasa por RPC.
