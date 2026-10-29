-- Operación compartida del Área TI.
-- No elimina columnas ni eventos existentes: los tickets históricos que aún
-- tengan técnico asignado siguen siendo legibles, pero las nuevas transiciones
-- ya no dependen de esa asignación.

alter table public.tickets
  drop constraint if exists tickets_tecnico_requerido,
  drop constraint if exists tickets_en_atencion_completo,
  drop constraint if exists tickets_resuelto_completo,
  drop constraint if exists tickets_cerrado_completo;

alter table public.tickets
  add constraint tickets_en_atencion_completo check (
    estado <> 'en_atencion' or fecha_inicio_atencion is not null
  ),
  add constraint tickets_resuelto_completo check (
    estado <> 'resuelto'
    or (fecha_resolucion is not null and solucion is not null)
  ),
  add constraint tickets_cerrado_completo check (
    estado <> 'cerrado'
    or (fecha_resolucion is not null and fecha_cierre is not null and solucion is not null)
  );

create or replace function private.registrar_ticket_compartido(
  p_actor_id uuid, p_asunto text, p_descripcion text, p_categoria_id uuid,
  p_solicitante_nombre text, p_solicitante_tipo text, p_ubicacion text,
  p_canal_origen text, p_clave_idempotencia text
)
returns public.tickets language plpgsql security definer set search_path = ''
as $$
declare v_ticket public.tickets; v_existente public.tickets;
  v_clave text := nullif(btrim(coalesce(p_clave_idempotencia,'')), '');
  v_asunto text := btrim(coalesce(p_asunto,''));
  v_descripcion text := btrim(coalesce(p_descripcion,''));
  v_nombre text := btrim(coalesce(p_solicitante_nombre,''));
  v_tipo text := lower(btrim(coalesce(p_solicitante_tipo,'')));
  v_ubicacion text := nullif(btrim(coalesce(p_ubicacion,'')), '');
  v_canal text := lower(btrim(coalesce(p_canal_origen,'manual')));
  v_huella text;
begin
  if not exists (select 1 from public.profiles where id=p_actor_id and activo and rol in ('admin','tecnico')) then
    raise exception using errcode='42501', message='perfil_inactivo';
  end if;
  if char_length(v_asunto) not between 3 and 150 or char_length(v_descripcion) not between 5 and 4000
    or char_length(v_nombre) not between 2 and 150 or v_tipo not in ('estudiante','docente','administrativo')
    or v_canal not in ('manual','ia','whatsapp','correo') or (v_ubicacion is not null and char_length(v_ubicacion)>200) then
    raise exception using errcode='P0001', message='datos_invalidos';
  end if;
  if not exists (select 1 from public.catalogo_categorias where id=p_categoria_id and activo) then
    raise exception using errcode='P0001', message='categoria_inactiva';
  end if;
  v_huella := md5(concat_ws('|',lower(v_asunto),lower(v_descripcion),p_categoria_id::text,lower(v_nombre),v_tipo,coalesce(lower(v_ubicacion),''),v_canal));
  if v_clave is not null then
    select * into v_existente from public.tickets where clave_idempotencia=v_clave;
    if found then
      if v_existente.created_by is distinct from p_actor_id or v_existente.huella_contenido is distinct from v_huella then
        raise exception using errcode='P0001', message='duplicate_request_conflict';
      end if;
      return v_existente;
    end if;
  end if;
  insert into public.tickets(asunto,descripcion,categoria_id,solicitante_nombre,solicitante_tipo,ubicacion,canal_origen,created_by,clave_idempotencia,huella_contenido)
    values(v_asunto,v_descripcion,p_categoria_id,v_nombre,v_tipo,v_ubicacion,v_canal,p_actor_id,v_clave,v_huella)
    on conflict (clave_idempotencia) do nothing returning * into v_ticket;
  if not found then
    select * into v_ticket from public.tickets where clave_idempotencia=v_clave for update;
    if v_ticket.created_by is distinct from p_actor_id or v_ticket.huella_contenido is distinct from v_huella then
      raise exception using errcode='P0001', message='duplicate_request_conflict';
    end if;
    return v_ticket;
  end if;
  insert into public.ticket_historial(ticket_id,accion,estado_anterior,estado_nuevo,actor_id) values(v_ticket.id,'creado',null,'nuevo',p_actor_id);
  return v_ticket;
end; $$;

revoke all on function private.registrar_ticket_compartido(uuid,text,text,uuid,text,text,text,text,text) from public, anon, authenticated;
grant execute on function private.registrar_ticket_compartido(uuid,text,text,uuid,text,text,text,text,text) to service_role;

-- Conserva el nombre histórico de la función para no romper dependencias,
-- pero su semántica pasa a ser la de cualquier operador activo.
create or replace function public.is_active_technician()
returns boolean
language sql stable security definer set search_path = ''
as $$ select public.is_active_staff(); $$;

-- La creación manual también queda disponible para las cuentas ADMIN activas.
create or replace function public.crear_ticket(
  p_asunto text, p_descripcion text, p_categoria_id uuid,
  p_solicitante_nombre text, p_solicitante_tipo text,
  p_ubicacion text default null, p_canal_origen text default 'manual',
  p_clave_idempotencia text default null
)
returns public.tickets
language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or not public.is_active_staff() then
    raise exception using errcode = '42501', message = 'perfil_inactivo';
  end if;
  return private.registrar_ticket_compartido(v_actor, p_asunto, p_descripcion,
    p_categoria_id, p_solicitante_nombre, p_solicitante_tipo, p_ubicacion,
    p_canal_origen, p_clave_idempotencia);
end;
$$;

-- Inicio: cualquier ADMIN activo puede iniciar o continuar un ticket.
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
  if v_ticket.estado = 'en_atencion' then return v_ticket; end if;
  if v_ticket.estado not in ('nuevo', 'reabierto') then
    raise exception using errcode = 'P0001', message = 'transicion_invalida';
  end if;
  v_anterior := v_ticket.estado;
  update public.tickets set estado = 'en_atencion', fecha_inicio_atencion = now()
    where id = p_ticket_id returning * into v_ticket;
  insert into public.ticket_historial(ticket_id, accion, estado_anterior, estado_nuevo, actor_id)
    values (p_ticket_id, 'iniciado', v_anterior, 'en_atencion', v_actor);
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
    fecha_resolucion = now(), fecha_cierre = null where id = p_ticket_id returning * into v_ticket;
  insert into public.ticket_historial(ticket_id, accion, estado_anterior, estado_nuevo, actor_id, detalle)
    values (p_ticket_id, 'resuelto', 'en_atencion', 'resuelto', v_actor, v_solucion);
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
  if v_ticket.estado = 'cerrado' then return v_ticket; end if;
  if v_ticket.estado <> 'resuelto' then raise exception using errcode = 'P0001', message = 'transicion_invalida'; end if;
  update public.tickets set estado = 'cerrado', fecha_cierre = now()
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
  update public.tickets set estado = 'reabierto', tecnico_asignado_id = null,
    fecha_inicio_atencion = null, fecha_resolucion = null, fecha_cierre = null
    where id = p_ticket_id returning * into v_ticket;
  insert into public.ticket_historial(ticket_id, accion, estado_anterior, estado_nuevo, actor_id, detalle)
    values (p_ticket_id, 'reabierto', v_anterior, 'reabierto', v_actor, v_motivo);
  return v_ticket;
end; $$;

revoke all on function public.tomar_ticket(uuid) from authenticated;
revoke all on function public.tomar_ticket(uuid) from anon;

-- Reporte agregado: solo ADMIN activo. Los buckets se calculan en Lima y los
-- tiempos usan los eventos reales del historial, incluyendo reaperturas.
create or replace function public.obtener_reporte_eficiencia()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'solo_admin'; end if;
  with base as (select * from public.tickets),
  tiempos as (
    select t.id, extract(epoch from (max(h_res.creado_en) - t.fecha_creacion))/60 as minutos_resolucion,
      extract(epoch from (min(h_ini.creado_en) - t.fecha_creacion))/60 as minutos_inicio
    from base t
    left join public.ticket_historial h_ini on h_ini.ticket_id=t.id and h_ini.accion='iniciado'
    left join public.ticket_historial h_res on h_res.ticket_id=t.id and h_res.accion='resuelto'
    group by t.id, t.fecha_creacion
  ), resumen as (
    select count(*) as recibidos, count(*) filter (where estado in ('resuelto','cerrado')) as resueltos,
      count(*) filter (where estado not in ('resuelto','cerrado')) as pendientes,
      count(*) filter (where exists (select 1 from public.ticket_historial h where h.ticket_id=t.id and h.accion='reabierto')) as reabiertos,
      round(avg(minutos_inicio)::numeric, 2) as tiempo_inicio_minutos,
      round(avg(minutos_resolucion)::numeric, 2) as tiempo_resolucion_minutos,
      round((100 * count(*) filter (where estado in ('resuelto','cerrado')) / nullif(count(*),0))::numeric, 2) as tasa_resolucion
    from base t join tiempos using(id)
  ), series as (
    select 'diaria' as periodo, to_char(fecha_creacion at time zone 'America/Lima','YYYY-MM-DD') as fecha,
      count(*) as recibidos, count(*) filter (where estado in ('resuelto','cerrado')) as resueltos
    from base group by 2
    union all select 'semanal', to_char(date_trunc('week', fecha_creacion at time zone 'America/Lima'),'YYYY-MM-DD'), count(*), count(*) filter (where estado in ('resuelto','cerrado')) from base group by 2
    union all select 'mensual', to_char(date_trunc('month', fecha_creacion at time zone 'America/Lima'),'YYYY-MM'), count(*), count(*) filter (where estado in ('resuelto','cerrado')) from base group by 2
  )
  select jsonb_build_object('resumen', (select row_to_json(resumen) from resumen), 'evolucion', coalesce((select jsonb_agg(series order by periodo, fecha) from series), '[]'::jsonb)) into v_result;
  return v_result;
end; $$;

revoke all on function public.obtener_reporte_eficiencia() from public;
revoke all on function public.obtener_reporte_eficiencia() from anon;
grant execute on function public.obtener_reporte_eficiencia() to authenticated;
