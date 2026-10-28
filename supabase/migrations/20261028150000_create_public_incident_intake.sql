-- Alta pública de incidencias.
-- La escritura nunca se concede a anon: la Edge Function usa service_role y
-- esta RPC vuelve a validar las relaciones antes de escribir ticket e historial.

create table if not exists public.catalogo_docentes (
  id uuid primary key default gen_random_uuid(),
  nombre_completo text not null,
  correo_institucional text not null,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint catalogo_docentes_nombre_ck check (char_length(btrim(nombre_completo)) between 2 and 150),
  constraint catalogo_docentes_correo_ck check (lower(btrim(correo_institucional)) ~ '^[^@[:space:]]+@ottotonsman\.edu\.pe$')
);
create unique index if not exists catalogo_docentes_correo_unico on public.catalogo_docentes (lower(btrim(correo_institucional)));

create table if not exists public.catalogo_pabellones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  activo boolean not null default true,
  constraint catalogo_pabellones_nombre_ck check (char_length(btrim(nombre)) between 1 and 80)
);
create unique index if not exists catalogo_pabellones_nombre_unico on public.catalogo_pabellones (lower(btrim(nombre)));

create table if not exists public.catalogo_pisos (
  id uuid primary key default gen_random_uuid(),
  pabellon_id uuid not null references public.catalogo_pabellones(id) on delete restrict,
  nombre text not null,
  activo boolean not null default true,
  constraint catalogo_pisos_nombre_ck check (char_length(btrim(nombre)) between 1 and 80)
);
create unique index if not exists catalogo_pisos_nombre_unico on public.catalogo_pisos (pabellon_id, lower(btrim(nombre)));

create table if not exists public.catalogo_ambientes (
  id uuid primary key default gen_random_uuid(),
  piso_id uuid not null references public.catalogo_pisos(id) on delete restrict,
  nombre text not null,
  activo boolean not null default true,
  constraint catalogo_ambientes_nombre_ck check (char_length(btrim(nombre)) between 1 and 100)
);
create unique index if not exists catalogo_ambientes_nombre_unico on public.catalogo_ambientes (piso_id, lower(btrim(nombre)));

create table if not exists public.catalogo_areas_administrativas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  activo boolean not null default true,
  constraint catalogo_areas_nombre_ck check (char_length(btrim(nombre)) between 1 and 100)
);
create unique index if not exists catalogo_areas_nombre_unico on public.catalogo_areas_administrativas (lower(btrim(nombre)));

create table if not exists public.catalogo_fallas_comunes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria_id uuid not null references public.catalogo_categorias(id) on delete restrict,
  activo boolean not null default true,
  constraint catalogo_fallas_nombre_ck check (char_length(btrim(nombre)) between 2 and 150)
);
create unique index if not exists catalogo_fallas_nombre_categoria_unico on public.catalogo_fallas_comunes (lower(btrim(nombre)), categoria_id);

create table if not exists public.catalogo_fallas_solicitante (
  falla_id uuid not null references public.catalogo_fallas_comunes(id) on delete cascade,
  solicitante_tipo text not null,
  primary key (falla_id, solicitante_tipo),
  constraint catalogo_fallas_solicitante_tipo_ck check (solicitante_tipo in ('estudiante', 'docente', 'administrativo'))
);

alter table public.tickets add column if not exists solicitante_dni text;
alter table public.tickets add column if not exists solicitante_correo text;
alter table public.tickets add column if not exists docente_id uuid references public.catalogo_docentes(id) on delete restrict;
alter table public.tickets add column if not exists area_administrativa_id uuid references public.catalogo_areas_administrativas(id) on delete restrict;
alter table public.tickets add column if not exists falla_comun_id uuid references public.catalogo_fallas_comunes(id) on delete restrict;
alter table public.tickets add column if not exists ambiente_id uuid references public.catalogo_ambientes(id) on delete restrict;
alter table public.tickets drop constraint if exists tickets_canal_origen_valido;
alter table public.tickets add constraint tickets_canal_origen_valido check (canal_origen in ('manual', 'ia', 'whatsapp', 'correo', 'web'));
alter table public.ticket_historial alter column actor_id drop not null;
alter table public.ticket_historial drop constraint if exists ticket_historial_actor_requerido_ck;
alter table public.ticket_historial add constraint ticket_historial_actor_requerido_ck check (
  actor_id is not null
  or (
    accion = 'creado'
    and detalle = 'Reporte público recibido mediante formulario web.'
  )
);

create index if not exists tickets_falla_comun_idx on public.tickets (falla_comun_id);
create index if not exists tickets_docente_idx on public.tickets (docente_id);

alter table public.catalogo_docentes enable row level security;
alter table public.catalogo_pabellones enable row level security;
alter table public.catalogo_pisos enable row level security;
alter table public.catalogo_ambientes enable row level security;
alter table public.catalogo_areas_administrativas enable row level security;
alter table public.catalogo_fallas_comunes enable row level security;
alter table public.catalogo_fallas_solicitante enable row level security;

revoke all on table public.catalogo_docentes, public.catalogo_pabellones, public.catalogo_pisos,
  public.catalogo_ambientes, public.catalogo_areas_administrativas, public.catalogo_fallas_comunes,
  public.catalogo_fallas_solicitante from public, anon, authenticated;
grant select on public.catalogo_docentes, public.catalogo_pabellones, public.catalogo_pisos,
  public.catalogo_ambientes, public.catalogo_areas_administrativas, public.catalogo_fallas_comunes,
  public.catalogo_fallas_solicitante to anon, authenticated;

drop policy if exists "catalogo_docentes_select_activos" on public.catalogo_docentes;
create policy "catalogo_docentes_select_activos" on public.catalogo_docentes for select to anon, authenticated using (activo);
drop policy if exists "catalogo_pabellones_select_activos" on public.catalogo_pabellones;
create policy "catalogo_pabellones_select_activos" on public.catalogo_pabellones for select to anon, authenticated using (activo);
drop policy if exists "catalogo_pisos_select_activos" on public.catalogo_pisos;
create policy "catalogo_pisos_select_activos" on public.catalogo_pisos for select to anon, authenticated using (activo and exists (select 1 from public.catalogo_pabellones p where p.id = pabellon_id and p.activo));
drop policy if exists "catalogo_ambientes_select_activos" on public.catalogo_ambientes;
create policy "catalogo_ambientes_select_activos" on public.catalogo_ambientes for select to anon, authenticated using (activo and exists (select 1 from public.catalogo_pisos p join public.catalogo_pabellones b on b.id = p.pabellon_id where p.id = piso_id and p.activo and b.activo));
drop policy if exists "catalogo_areas_select_activos" on public.catalogo_areas_administrativas;
create policy "catalogo_areas_select_activos" on public.catalogo_areas_administrativas for select to anon, authenticated using (activo);
drop policy if exists "catalogo_fallas_select_activos" on public.catalogo_fallas_comunes;
create policy "catalogo_fallas_select_activos" on public.catalogo_fallas_comunes for select to anon, authenticated using (activo);
drop policy if exists "catalogo_fallas_solicitante_select" on public.catalogo_fallas_solicitante;
create policy "catalogo_fallas_solicitante_select" on public.catalogo_fallas_solicitante for select to anon, authenticated using (exists (select 1 from public.catalogo_fallas_comunes f where f.id = falla_id and f.activo));

insert into public.catalogo_areas_administrativas (nombre) values
  ('Tesorería'), ('Atención al Estudiante'), ('Contabilidad'), ('Marketing'), ('Logística'), ('Otros')
on conflict do nothing;

insert into public.catalogo_fallas_comunes (nombre, categoria_id)
select v.nombre, c.id from (values
  ('Problemas con Wi-Fi', 'Redes y conectividad'), ('Computadora de laboratorio no funciona', 'Hardware'), ('Problemas con plataforma académica', 'Software'), ('Software académico no abre', 'Software'), ('Otro problema', 'Otros'),
  ('Proyector no funciona', 'Hardware'), ('Computadora del aula no enciende', 'Hardware'), ('Problemas con audio o micrófono', 'Hardware'), ('Sin conexión a internet', 'Redes y conectividad'), ('Proyector o pantalla sin señal', 'Hardware'),
  ('Impresora no imprime', 'Impresoras'), ('Computadora no enciende', 'Hardware'), ('Problemas con correo institucional', 'Cuentas y accesos'), ('Sistema administrativo no funciona', 'Software')
) v(nombre, categoria)
join public.catalogo_categorias c on c.nombre = v.categoria
on conflict do nothing;

insert into public.catalogo_fallas_solicitante (falla_id, solicitante_tipo)
select f.id, t.tipo from public.catalogo_fallas_comunes f cross join (values ('estudiante'), ('docente'), ('administrativo')) t(tipo)
where (t.tipo = 'estudiante' and f.nombre in ('Problemas con Wi-Fi', 'Computadora de laboratorio no funciona', 'Problemas con plataforma académica', 'Software académico no abre', 'Otro problema'))
   or (t.tipo = 'docente' and f.nombre in ('Proyector no funciona', 'Computadora del aula no enciende', 'Problemas con audio o micrófono', 'Sin conexión a internet', 'Proyector o pantalla sin señal', 'Otro problema'))
   or (t.tipo = 'administrativo' and f.nombre in ('Impresora no imprime', 'Computadora no enciende', 'Sin conexión a internet', 'Problemas con correo institucional', 'Sistema administrativo no funciona', 'Otro problema'))
on conflict do nothing;

create table if not exists private.publico_rate_limits (
  ip_hash text not null,
  ventana date not null default current_date,
  solicitudes integer not null default 0,
  primary key (ip_hash, ventana)
);
revoke all on table private.publico_rate_limits from public, anon, authenticated;
grant select, insert, update on private.publico_rate_limits to service_role;

create or replace function public.registrar_ticket_publico(
  p_solicitante_tipo text, p_solicitante_nombre text, p_dni text,
  p_correo text, p_docente_id uuid, p_area_id uuid, p_falla_id uuid,
  p_ambiente_id uuid, p_ubicacion text, p_descripcion text,
  p_clave_idempotencia text, p_ip_hash text
)
returns table (numero_ticket text)
language plpgsql security definer set search_path = ''
as $$
declare v_ticket public.tickets; v_tipo text := lower(btrim(coalesce(p_solicitante_tipo, ''))); v_nombre text := btrim(coalesce(p_solicitante_nombre, '')); v_descripcion text := btrim(coalesce(p_descripcion, '')); v_clave text := btrim(coalesce(p_clave_idempotencia, '')); v_falla public.catalogo_fallas_comunes; v_docente public.catalogo_docentes; v_area public.catalogo_areas_administrativas; v_ambiente public.catalogo_ambientes; v_hash text;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then raise exception using errcode = 'P0001', message = 'solicitud_rechazada'; end if;
  insert into private.publico_rate_limits(ip_hash, solicitudes) values (p_ip_hash, 1)
    on conflict (ip_hash, ventana) do update set solicitudes = private.publico_rate_limits.solicitudes + 1;
  if (select solicitudes from private.publico_rate_limits where ip_hash = p_ip_hash and ventana = current_date) > 20 then raise exception using errcode = 'P0001', message = 'demasiadas_solicitudes'; end if;
  if v_tipo not in ('estudiante', 'docente', 'administrativo') or char_length(v_descripcion) not between 5 and 4000 or char_length(coalesce(p_ubicacion, '')) > 200 or char_length(v_clave) not between 1 and 200 then raise exception using errcode = 'P0001', message = 'datos_invalidos'; end if;
  select f.* into v_falla from public.catalogo_fallas_comunes f join public.catalogo_fallas_solicitante s on s.falla_id = f.id where f.id = p_falla_id and f.activo and s.solicitante_tipo = v_tipo;
  if not found then raise exception using errcode = 'P0001', message = 'falla_invalida'; end if;
  if v_tipo = 'estudiante' and (p_dni !~ '^[0-9]{8}$' or p_docente_id is not null or p_area_id is not null or p_correo is not null) then raise exception using errcode = 'P0001', message = 'dni_invalido'; end if;
  if v_tipo = 'docente' then
    select * into v_docente from public.catalogo_docentes where id = p_docente_id and activo and lower(correo_institucional) ~ '^[^@]+@ottotonsman\.edu\.pe$';
    if not found or lower(btrim(coalesce(p_correo, ''))) <> lower(btrim(v_docente.correo_institucional)) or p_dni is not null or p_area_id is not null then raise exception using errcode = 'P0001', message = 'docente_invalido'; end if;
    select a.* into v_ambiente from public.catalogo_ambientes a join public.catalogo_pisos p on p.id = a.piso_id join public.catalogo_pabellones b on b.id = p.pabellon_id where a.id = p_ambiente_id and a.activo and p.activo and b.activo;
    if not found then raise exception using errcode = 'P0001', message = 'ubicacion_invalida'; end if;
    v_nombre := v_docente.nombre_completo;
  elsif v_tipo = 'administrativo' then
    if lower(btrim(coalesce(p_correo, ''))) !~ '^[^@]+@ottotonsman\.edu\.pe$' then raise exception using errcode = 'P0001', message = 'correo_invalido'; end if;
    select * into v_area from public.catalogo_areas_administrativas where id = p_area_id and activo;
    if not found or (v_area.nombre = 'Otros' and char_length(v_nombre) not between 2 and 150) or p_dni is not null or p_docente_id is not null or p_ambiente_id is not null then raise exception using errcode = 'P0001', message = 'area_invalida'; end if;
    v_nombre := case when v_area.nombre = 'Otros' then v_nombre else v_area.nombre end;
  else v_nombre := 'Alumno'; end if;
  if v_tipo = 'estudiante' and p_ambiente_id is not null then raise exception using errcode = 'P0001', message = 'datos_invalidos'; end if;
  v_hash := md5(concat_ws('|', v_tipo, lower(v_nombre), coalesce(p_dni, ''), lower(btrim(coalesce(p_correo, ''))), p_falla_id::text, coalesce(p_ambiente_id::text, ''), v_descripcion));
  select * into v_ticket from public.tickets where clave_idempotencia = v_clave;
  if found then if v_ticket.huella_contenido <> v_hash then raise exception using errcode = 'P0001', message = 'duplicate_request_conflict'; end if; return query select v_ticket.numero_ticket; return; end if;
  insert into public.tickets(estado, asunto, descripcion, categoria_id, solicitante_nombre, solicitante_tipo, ubicacion, canal_origen, clave_idempotencia, huella_contenido, solicitante_dni, solicitante_correo, docente_id, area_administrativa_id, falla_comun_id, ambiente_id)
  values ('nuevo', v_falla.nombre, v_descripcion, v_falla.categoria_id, v_nombre, v_tipo, nullif(btrim(coalesce(p_ubicacion, '')), ''), 'web', v_clave, v_hash, case when v_tipo = 'estudiante' then p_dni end, case when v_tipo <> 'estudiante' then lower(btrim(p_correo)) end, case when v_tipo = 'docente' then p_docente_id end, case when v_tipo = 'administrativo' then p_area_id end, p_falla_id, case when v_tipo = 'docente' then p_ambiente_id end) on conflict (clave_idempotencia) do nothing returning * into v_ticket;
  if not found then
    select * into v_ticket from public.tickets where clave_idempotencia = v_clave for update;
    if not found then raise exception using errcode = 'P0001', message = 'internal_error'; end if;
    if v_ticket.huella_contenido <> v_hash then raise exception using errcode = 'P0001', message = 'duplicate_request_conflict'; end if;
    return query select v_ticket.numero_ticket;
    return;
  end if;
  insert into public.ticket_historial(ticket_id, accion, estado_anterior, estado_nuevo, actor_id, detalle) values (v_ticket.id, 'creado', null, 'nuevo', null, 'Reporte público recibido mediante formulario web.');
  return query select v_ticket.numero_ticket;
end; $$;
revoke all on function public.registrar_ticket_publico(text,text,text,text,uuid,uuid,uuid,uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.registrar_ticket_publico(text,text,text,text,uuid,uuid,uuid,uuid,text,text,text,text) to service_role;
