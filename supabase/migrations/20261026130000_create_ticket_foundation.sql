-- Fundamento del módulo de tickets
--
-- Crea los helpers de autorización del personal, la política de lectura de
-- perfiles necesaria para mostrar la atribución de tickets y el catálogo de
-- categorías. No concede escritura directa al cliente.

-- Comprueba que el usuario autenticado tenga un perfil activo de personal.
-- Se ejecuta como propietario y con search_path fijado para evitar recursión
-- en las políticas RLS de public.profiles.
create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.activo
      and p.rol in ('admin', 'tecnico')
  );
$$;

comment on function public.is_active_staff() is
  'Devuelve true solo si el usuario autenticado tiene un perfil activo de personal.';

revoke all on function public.is_active_staff() from public;
revoke all on function public.is_active_staff() from anon;
grant execute on function public.is_active_staff() to authenticated;

-- Las operaciones de tickets requieren rol tecnico. El rol admin conserva
-- acceso de lectura para supervisión, pero no puede tomar ni resolver tickets.
create or replace function public.is_active_technician()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.activo
      and p.rol = 'tecnico'
  );
$$;

comment on function public.is_active_technician() is
  'Devuelve true solo si el usuario autenticado tiene un perfil tecnico activo.';

revoke all on function public.is_active_technician() from public;
revoke all on function public.is_active_technician() from anon;
grant execute on function public.is_active_technician() to authenticated;

-- Mantiene actualizado_en en el servidor. No se acepta un valor del cliente.
create or replace function public.set_actualizado_en()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

revoke all on function public.set_actualizado_en() from public;

-- Los técnicos comparten el mostrador: necesitan leer el nombre del técnico
-- asignado y del actor del historial. La política expone únicamente filas de
-- public.profiles (nombres, rol y estado), nunca credenciales.
drop policy if exists "profiles_select_active_staff" on public.profiles;
create policy "profiles_select_active_staff"
on public.profiles
for select
to authenticated
using ((select public.is_active_staff()));

-- Catálogo de categorías. Desactivar una categoría conserva las referencias
-- históricas de los tickets; no se elimina físicamente desde el cliente.
create table if not exists public.catalogo_categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint catalogo_categorias_nombre_longitud
    check (char_length(btrim(nombre)) between 1 and 80),
  constraint catalogo_categorias_descripcion_longitud
    check (descripcion is null or char_length(descripcion) <= 300)
);

comment on table public.catalogo_categorias is
  'Catálogo de categorías de tickets. Solo lectura desde el cliente.';
comment on column public.catalogo_categorias.activo is
  'Una categoría inactiva no puede usarse en tickets nuevos, pero conserva su historial.';

create unique index if not exists catalogo_categorias_nombre_unico
  on public.catalogo_categorias (lower(btrim(nombre)));

drop trigger if exists catalogo_categorias_set_actualizado_en
  on public.catalogo_categorias;

create trigger catalogo_categorias_set_actualizado_en
before update on public.catalogo_categorias
for each row
execute function public.set_actualizado_en();

alter table public.catalogo_categorias enable row level security;

drop policy if exists "catalogo_categorias_select_staff"
  on public.catalogo_categorias;

create policy "catalogo_categorias_select_staff"
on public.catalogo_categorias
for select
to authenticated
using ((select public.is_active_staff()));

revoke all on table public.catalogo_categorias from public;
revoke all on table public.catalogo_categorias from anon;
revoke all on table public.catalogo_categorias from authenticated;
grant select on table public.catalogo_categorias to authenticated;

-- Catálogo inicial provisional. La institución debe revisarlo y mantenerlo
-- mediante una operación administrativa controlada (DP-01).
insert into public.catalogo_categorias (nombre, descripcion)
values
  ('Hardware', 'Equipos, componentes y periféricos.'),
  ('Software', 'Aplicaciones, sistema operativo y licencias.'),
  ('Redes y conectividad', 'Wi-Fi, cableado, VPN y acceso a internet.'),
  ('Cuentas y accesos', 'Credenciales, correo institucional y permisos.'),
  ('Impresoras', 'Impresión, escaneo y consumibles.'),
  ('Otros', 'Casos que no encajan en las categorías anteriores.')
on conflict do nothing;
