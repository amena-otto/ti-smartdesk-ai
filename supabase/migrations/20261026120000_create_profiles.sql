-- Perfiles de usuario de TI SmartDesk AI
--
-- Cada fila de public.profiles corresponde 1:1 con una cuenta de auth.users.
-- No se crean perfiles automáticamente: las cuentas se aprovisionan de forma
-- controlada con un rol de confianza (por ejemplo, el editor SQL de Supabase).
-- El cliente autenticado solo puede leer su propio perfil; no tiene DML directo.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombres text not null,
  apellidos text not null,
  rol text not null default 'tecnico',
  activo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_nombres_longitud
    check (char_length(btrim(nombres)) between 1 and 100),
  constraint profiles_apellidos_longitud
    check (char_length(btrim(apellidos)) between 1 and 120),
  constraint profiles_rol_valido
    check (rol in ('admin', 'tecnico'))
);

comment on table public.profiles is
  'Perfil operativo 1:1 con auth.users. Sin escritura directa desde el cliente.';
comment on column public.profiles.id is
  'Identificador de la cuenta en auth.users.';
comment on column public.profiles.nombres is
  'Nombres de la persona. Se muestran en la interfaz.';
comment on column public.profiles.apellidos is
  'Apellidos de la persona. Se muestran en la interfaz.';
comment on column public.profiles.rol is
  'Rol operativo: admin o tecnico. Por defecto, el menor privilegio.';
comment on column public.profiles.activo is
  'Habilita el uso del sistema. Por defecto, inactivo hasta aprovisionamiento explícito.';

-- Mantiene updated_at en el servidor. No se acepta un valor enviado por el cliente.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;

drop trigger if exists profiles_set_updated_at on public.profiles;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- Comprueba el rol administrativo sin provocar recursión en las políticas RLS.
-- Se ejecuta como propietario de la función y con search_path fijado.
create or replace function public.is_admin()
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
      and p.rol = 'admin'
      and p.activo
  );
$$;

comment on function public.is_admin() is
  'Devuelve true solo si el usuario autenticado tiene un perfil admin activo.';

revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

-- RLS: lectura del propio perfil y lectura administrativa explícita.
-- La lectura del propio perfil se permite aunque esté inactivo para que la
-- aplicación pueda detectar y rechazar la cuenta. Las tablas de dominio deberán
-- exigir un perfil activo en sus propias políticas.
-- No hay políticas de INSERT, UPDATE ni DELETE: el cliente no puede escribir.
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
on public.profiles
for select
to authenticated
using ((select public.is_admin()));

-- Privilegios mínimos para el rol autenticado. El service_role no se usa en el navegador.
revoke all on table public.profiles from public;
revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
