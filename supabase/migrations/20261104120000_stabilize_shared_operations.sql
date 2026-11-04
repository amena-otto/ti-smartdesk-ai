-- Estabilización incremental del PR #5. No reescribe migraciones ni datos históricos.
-- Supabase CLI ejecuta cada archivo dentro de su propia transacción. No se
-- incluyen BEGIN/COMMIT explícitos para no romper la atomicidad del runner.

-- CHECK rechaza NULL explícitamente; NOT VALID conserva eventos históricos
-- irregulares para su revisión, pero protege toda inserción nueva.
alter table public.ticket_historial drop constraint ticket_historial_actor_requerido_ck;
alter table public.ticket_historial add constraint ticket_historial_actor_requerido_ck check (
  actor_id is not null or (
    accion = 'creado' and estado_anterior is null and estado_nuevo = 'nuevo'
    and detalle is not distinct from 'Reporte público recibido mediante formulario web.'
  )
) not valid;

-- Proyección pública por columnas: RLS sigue filtrando docentes activos.
revoke all on public.catalogo_docentes from public, anon, authenticated;
grant select (id, nombre_completo) on public.catalogo_docentes to anon, authenticated;

-- BYPASSRLS no equivale a mínimos privilegios. El servidor escribe mediante RPC.
revoke all on public.tickets, public.ticket_historial from service_role;
grant select on public.tickets, public.ticket_historial to service_role;

-- Un punto literal en el dominio, independiente de standard_conforming_strings.
alter table public.catalogo_docentes drop constraint catalogo_docentes_correo_ck;
alter table public.catalogo_docentes add constraint catalogo_docentes_correo_ck
  check (lower(btrim(correo_institucional)) ~ '^[^@[:space:]]+@ottotonsman[.]edu[.]pe$') not valid;

create or replace function public.iniciar_atencion(p_ticket_id uuid)
returns public.tickets language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_ticket public.tickets; v_anterior text;
begin
  if v_actor is null or not public.is_active_staff() then
    raise exception using errcode = '42501', message = 'perfil_inactivo';
  end if;
  select * into v_ticket from public.tickets where id = p_ticket_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'ticket_no_encontrado'; end if;
  if v_ticket.estado not in ('nuevo', 'reabierto') then
    raise exception using errcode = 'P0001', message = 'transicion_invalida';
  end if;
  v_anterior := v_ticket.estado;
  update public.tickets set estado = 'en_atencion', fecha_inicio_atencion = clock_timestamp()
    where id = p_ticket_id returning * into v_ticket;
  insert into public.ticket_historial(ticket_id, accion, estado_anterior, estado_nuevo, actor_id)
    values (p_ticket_id, 'iniciado', v_anterior, 'en_atencion', v_actor);
  return v_ticket;
end; $$;

create or replace function public.cerrar_ticket(p_ticket_id uuid)
returns public.tickets language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_ticket public.tickets;
begin
  if v_actor is null or not public.is_active_staff() then
    raise exception using errcode = '42501', message = 'perfil_inactivo';
  end if;
  select * into v_ticket from public.tickets where id = p_ticket_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'ticket_no_encontrado'; end if;
  if v_ticket.estado <> 'resuelto' then raise exception using errcode = 'P0001', message = 'transicion_invalida'; end if;
  update public.tickets set estado = 'cerrado', fecha_cierre = clock_timestamp()
    where id = p_ticket_id returning * into v_ticket;
  insert into public.ticket_historial(ticket_id, accion, estado_anterior, estado_nuevo, actor_id)
    values (p_ticket_id, 'cerrado', 'resuelto', 'cerrado', v_actor);
  return v_ticket;
end; $$;

create or replace function public.reabrir_ticket(p_ticket_id uuid, p_motivo text default null)
returns public.tickets language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_ticket public.tickets; v_anterior text; v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  if v_actor is null or not public.is_active_staff() then
    raise exception using errcode = '42501', message = 'perfil_inactivo';
  end if;
  if v_motivo is not null and char_length(v_motivo) > 1000 then raise exception using errcode = 'P0001', message = 'datos_invalidos'; end if;
  select * into v_ticket from public.tickets where id = p_ticket_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'ticket_no_encontrado'; end if;
  if v_ticket.estado not in ('resuelto', 'cerrado') then raise exception using errcode = 'P0001', message = 'transicion_invalida'; end if;
  v_anterior := v_ticket.estado;
  update public.tickets set estado = 'reabierto',
    fecha_inicio_atencion = null, fecha_resolucion = null, fecha_cierre = null
    where id = p_ticket_id returning * into v_ticket;
  insert into public.ticket_historial(ticket_id, accion, estado_anterior, estado_nuevo, actor_id, detalle)
    values (p_ticket_id, 'reabierto', v_anterior, 'reabierto', v_actor, v_motivo);
  return v_ticket;
end; $$;

create or replace function public.resolver_ticket(p_ticket_id uuid, p_solucion text)
returns public.tickets language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_ticket public.tickets; v_solucion text := btrim(coalesce(p_solucion, ''));
begin
  if v_actor is null or not public.is_active_staff() then
    raise exception using errcode = '42501', message = 'perfil_inactivo';
  end if;
  if char_length(v_solucion) < 5 then raise exception using errcode = 'P0001', message = 'solucion_requerida'; end if;
  if char_length(v_solucion) > 4000 then raise exception using errcode = 'P0001', message = 'datos_invalidos'; end if;
  select * into v_ticket from public.tickets where id = p_ticket_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'ticket_no_encontrado'; end if;
  if v_ticket.estado <> 'en_atencion' then raise exception using errcode = 'P0001', message = 'transicion_invalida'; end if;
  update public.tickets set estado = 'resuelto', solucion = v_solucion,
    fecha_resolucion = clock_timestamp(), fecha_cierre = null where id = p_ticket_id returning * into v_ticket;
  insert into public.ticket_historial(ticket_id, accion, estado_anterior, estado_nuevo, actor_id, detalle)
    values (p_ticket_id, 'resuelto', 'en_atencion', 'resuelto', v_actor, v_solucion);
  return v_ticket;
end; $$;

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
  if not exists (select 1 from public.catalogo_categorias where id = v_falla.categoria_id and activo) then raise exception using errcode = 'P0001', message = 'categoria_inactiva'; end if;
  if v_tipo = 'estudiante' and (coalesce(p_dni, '') !~ '^[0-9]{8}$' or p_docente_id is not null or p_area_id is not null or p_correo is not null) then raise exception using errcode = 'P0001', message = 'dni_invalido'; end if;
  if v_tipo = 'docente' then
    select * into v_docente from public.catalogo_docentes where id = p_docente_id and activo and lower(correo_institucional) ~ '^[^@]+@ottotonsman\.edu\.pe$';
    if not found or p_dni is not null or p_area_id is not null then raise exception using errcode = 'P0001', message = 'docente_invalido'; end if;
    select a.* into v_ambiente from public.catalogo_ambientes a join public.catalogo_pisos p on p.id = a.piso_id join public.catalogo_pabellones b on b.id = p.pabellon_id where a.id = p_ambiente_id and a.activo and p.activo and b.activo;
    if not found then raise exception using errcode = 'P0001', message = 'ubicacion_invalida'; end if;
    v_nombre := v_docente.nombre_completo;
    p_correo := lower(btrim(v_docente.correo_institucional));
  elsif v_tipo = 'administrativo' then
    if lower(btrim(coalesce(p_correo, ''))) !~ '^[^@]+@ottotonsman\.edu\.pe$' then raise exception using errcode = 'P0001', message = 'correo_invalido'; end if;
    select * into v_area from public.catalogo_areas_administrativas where id = p_area_id and activo;
    if not found or (v_area.nombre = 'Otros' and char_length(v_nombre) not between 2 and 150) or p_dni is not null or p_docente_id is not null or p_ambiente_id is not null then raise exception using errcode = 'P0001', message = 'area_invalida'; end if;
    v_nombre := case when v_area.nombre = 'Otros' then v_nombre else v_area.nombre end;
  else v_nombre := 'Alumno'; end if;
  if v_tipo = 'estudiante' and p_ambiente_id is not null then raise exception using errcode = 'P0001', message = 'datos_invalidos'; end if;
  v_hash := md5(jsonb_build_array('publico-v2', v_tipo, v_nombre, p_dni, p_correo, p_docente_id, p_area_id, p_falla_id, p_ambiente_id, nullif(btrim(coalesce(p_ubicacion, '')), ''), v_descripcion)::text);
  select * into v_ticket from public.tickets where clave_idempotencia = v_clave;
  if found then if v_ticket.canal_origen <> 'web' or v_ticket.huella_contenido is distinct from v_hash then raise exception using errcode = 'P0001', message = 'duplicate_request_conflict'; end if; return query select v_ticket.numero_ticket; return; end if;
  insert into public.tickets(estado, asunto, descripcion, categoria_id, solicitante_nombre, solicitante_tipo, ubicacion, canal_origen, clave_idempotencia, huella_contenido, solicitante_dni, solicitante_correo, docente_id, area_administrativa_id, falla_comun_id, ambiente_id)
  values ('nuevo', v_falla.nombre, v_descripcion, v_falla.categoria_id, v_nombre, v_tipo, nullif(btrim(coalesce(p_ubicacion, '')), ''), 'web', v_clave, v_hash, case when v_tipo = 'estudiante' then p_dni end, case when v_tipo <> 'estudiante' then lower(btrim(p_correo)) end, case when v_tipo = 'docente' then p_docente_id end, case when v_tipo = 'administrativo' then p_area_id end, p_falla_id, case when v_tipo = 'docente' then p_ambiente_id end) on conflict (clave_idempotencia) do nothing returning * into v_ticket;
  if not found then
    select * into v_ticket from public.tickets where clave_idempotencia = v_clave for update;
    if not found then raise exception using errcode = 'P0001', message = 'internal_error'; end if;
    if v_ticket.canal_origen <> 'web' or v_ticket.huella_contenido is distinct from v_hash then raise exception using errcode = 'P0001', message = 'duplicate_request_conflict'; end if;
    return query select v_ticket.numero_ticket;
    return;
  end if;
  insert into public.ticket_historial(ticket_id, accion, estado_anterior, estado_nuevo, actor_id, detalle) values (v_ticket.id, 'creado', null, 'nuevo', null, 'Reporte público recibido mediante formulario web.');
  return query select v_ticket.numero_ticket;
end; $$;

create or replace function public.obtener_reporte_eficiencia(
  p_fecha_desde date default null,
  p_fecha_hasta date default null,
  p_categoria_id uuid default null,
  p_solicitante_tipo text default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_result jsonb;
  v_desde timestamptz;
  v_hasta timestamptz;
  v_tipo text := nullif(lower(btrim(coalesce(p_solicitante_tipo, ''))), '');
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'solo_admin';
  end if;

  if v_tipo is not null and v_tipo not in ('estudiante','docente','administrativo') then
    raise exception using errcode = 'P0001', message = 'datos_invalidos';
  end if;

  if p_fecha_desde is not null then
    v_desde := (p_fecha_desde::timestamp at time zone 'America/Lima');
  end if;

  if p_fecha_hasta is not null then
    v_hasta := ((p_fecha_hasta + 1)::timestamp at time zone 'America/Lima');
  end if;

  if v_desde is not null and v_hasta is not null and v_desde >= v_hasta then
    raise exception using errcode = 'P0001', message = 'datos_invalidos';
  end if;

  with tickets_filtrados as (
    select t.*
    from public.tickets t
    where (p_categoria_id is null or t.categoria_id = p_categoria_id)
      and (v_tipo is null or t.solicitante_tipo = v_tipo)
  ),
  recibidos as (
    select tf.*
    from tickets_filtrados tf
    where (v_desde is null or tf.fecha_creacion >= v_desde)
      and (v_hasta is null or tf.fecha_creacion < v_hasta)
  ),
  ciclos as (
    select tf.id, coalesce(ultimo.creado_en, tf.fecha_creacion) as inicio_ciclo,
      coalesce(ultimo.id, 0) as evento_inicio_id
    from tickets_filtrados tf
    left join lateral (
      select h.id, h.creado_en from public.ticket_historial h
      where h.ticket_id = tf.id and h.accion = 'reabierto'
      order by h.id desc limit 1
    ) ultimo on true
  ),
  eventos_ciclo as (
    select c.id, c.inicio_ciclo,
      min(h.creado_en) filter (where h.accion = 'iniciado') as inicio_atencion,
      max(h.creado_en) filter (where h.accion = 'resuelto') as resolucion
    from ciclos c
    left join public.ticket_historial h
      on h.ticket_id = c.id and h.id > c.evento_inicio_id
    group by c.id, c.inicio_ciclo
  ),
  tiempos as (
    select c.id,
      extract(epoch from (e.inicio_atencion - c.inicio_ciclo)) / 60 as minutos_inicio,
      extract(epoch from (e.resolucion - c.inicio_ciclo)) / 60 as minutos_resolucion
    from ciclos c
    join eventos_ciclo e on e.id = c.id
  ),
  eventos as (
    select tf.id as ticket_id, 'recibido'::text as tipo, tf.fecha_creacion as momento
    from tickets_filtrados tf
    where (v_desde is null or tf.fecha_creacion >= v_desde)
      and (v_hasta is null or tf.fecha_creacion < v_hasta)
    union all
    select tf.id, 'resuelto', h.creado_en
    from public.ticket_historial h
    join tickets_filtrados tf on tf.id = h.ticket_id
    where h.accion = 'resuelto'
      and (v_desde is null or h.creado_en >= v_desde)
      and (v_hasta is null or h.creado_en < v_hasta)
    union all
    select tf.id, 'reabierto', h.creado_en
    from public.ticket_historial h
    join tickets_filtrados tf on tf.id = h.ticket_id
    where h.accion = 'reabierto'
      and (v_desde is null or h.creado_en >= v_desde)
      and (v_hasta is null or h.creado_en < v_hasta)
  ),
  resumen as (
    select
      (select count(*) from recibidos) as recibidos,
      (select count(distinct e.ticket_id) from eventos e where e.tipo = 'resuelto') as resueltos,
      (select count(*) from recibidos r where r.estado not in ('resuelto','cerrado')) as pendientes,
      (select count(*) from eventos e where e.tipo = 'reabierto') as reabiertos,
      (select round(avg(t.minutos_inicio)::numeric, 2)
        from tiempos t join recibidos r on r.id = t.id) as tiempo_inicio_minutos,
      (select round(avg(t.minutos_resolucion)::numeric, 2)
        from tiempos t join recibidos r on r.id = t.id) as tiempo_resolucion_minutos
  ),
  resumen_tasa as (
    select r.*,
      case
        when r.recibidos > 0
          then round((100.0 * r.resueltos / r.recibidos)::numeric, 2)
        else null
      end as tasa_resolucion
    from resumen r
  ),
  series as (
    select p.periodo, p.fecha,
      count(*) filter (where e.tipo = 'recibido') as recibidos,
      count(distinct e.ticket_id) filter (where e.tipo = 'resuelto') as resueltos
    from eventos e
    cross join lateral (
      values
        ('diaria', to_char(e.momento at time zone 'America/Lima', 'YYYY-MM-DD')),
        ('semanal', to_char(date_trunc('week', e.momento at time zone 'America/Lima'), 'YYYY-MM-DD')),
        ('mensual', to_char(date_trunc('month', e.momento at time zone 'America/Lima'), 'YYYY-MM'))
    ) as p(periodo, fecha)
    group by p.periodo, p.fecha
  )
  select jsonb_build_object(
    'resumen', (select row_to_json(r) from resumen_tasa r),
    'evolucion', coalesce(
      (select jsonb_agg(s order by s.periodo, s.fecha) from series s),
      '[]'::jsonb
    )
  ) into v_result;

  return v_result;
end; $$;
