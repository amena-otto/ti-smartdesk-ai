-- Funciones RPC del ciclo de vida de tickets
--
-- Toda escritura se concentra aquí. Las funciones públicas derivan el actor de
-- la sesión, bloquean la fila antes de una transición y registran el historial
-- en la misma transacción. La función privada con actor explícito queda como
-- preparación para futuras integraciones de servidor, sin exponerla al cliente.

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
grant usage on schema private to service_role;

-- Núcleo de creación con actor explícito. No depende de auth.uid(), por lo que
-- una futura integración de servidor puede usarlo con un perfil de servicio.
-- No se concede a anon ni a authenticated.
create or replace function private.registrar_ticket(
  p_actor_id uuid,
  p_asunto text,
  p_descripcion text,
  p_categoria_id uuid,
  p_solicitante_nombre text,
  p_solicitante_tipo text,
  p_ubicacion text,
  p_canal_origen text,
  p_clave_idempotencia text
)
returns public.tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asunto text := btrim(coalesce(p_asunto, ''));
  v_descripcion text := btrim(coalesce(p_descripcion, ''));
  v_solicitante_nombre text := btrim(coalesce(p_solicitante_nombre, ''));
  v_solicitante_tipo text := lower(btrim(coalesce(p_solicitante_tipo, '')));
  v_ubicacion text := nullif(btrim(coalesce(p_ubicacion, '')), '');
  v_canal_origen text := lower(btrim(coalesce(p_canal_origen, 'manual')));
  v_clave text := nullif(btrim(coalesce(p_clave_idempotencia, '')), '');
  v_huella text;
  v_ticket public.tickets;
  v_existente public.tickets;
begin
  if p_actor_id is null then
    raise exception using errcode = '42501', message = 'no_autenticado';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_actor_id
      and p.activo
      and p.rol = 'tecnico'
  ) then
    raise exception using errcode = '42501', message = 'perfil_inactivo';
  end if;

  if char_length(v_asunto) not between 3 and 150 then
    raise exception using errcode = 'P0001', message = 'datos_invalidos';
  end if;

  if char_length(v_descripcion) not between 5 and 4000 then
    raise exception using errcode = 'P0001', message = 'datos_invalidos';
  end if;

  if char_length(v_solicitante_nombre) not between 2 and 150 then
    raise exception using errcode = 'P0001', message = 'datos_invalidos';
  end if;

  if v_solicitante_tipo not in ('estudiante', 'docente', 'administrativo') then
    raise exception using errcode = 'P0001', message = 'datos_invalidos';
  end if;

  if v_canal_origen not in ('manual', 'ia', 'whatsapp', 'correo') then
    raise exception using errcode = 'P0001', message = 'datos_invalidos';
  end if;

  if v_ubicacion is not null and char_length(v_ubicacion) > 200 then
    raise exception using errcode = 'P0001', message = 'datos_invalidos';
  end if;

  if v_clave is not null and char_length(v_clave) > 200 then
    raise exception using errcode = 'P0001', message = 'datos_invalidos';
  end if;

  if p_categoria_id is null or not exists (
    select 1
    from public.catalogo_categorias c
    where c.id = p_categoria_id
      and c.activo
  ) then
    raise exception using errcode = 'P0001', message = 'categoria_inactiva';
  end if;

  v_huella := md5(concat_ws(
    '|',
    lower(v_asunto),
    lower(v_descripcion),
    p_categoria_id::text,
    lower(v_solicitante_nombre),
    v_solicitante_tipo,
    coalesce(lower(v_ubicacion), ''),
    v_canal_origen
  ));

  if v_clave is not null then
    select *
    into v_existente
    from public.tickets t
    where t.clave_idempotencia = v_clave;

    if found then
      if v_existente.created_by is distinct from p_actor_id
        or v_existente.huella_contenido is distinct from v_huella then
        raise exception using errcode = 'P0001', message = 'duplicate_request_conflict';
      end if;

      return v_existente;
    end if;
  end if;

  insert into public.tickets (
    asunto,
    descripcion,
    categoria_id,
    solicitante_nombre,
    solicitante_tipo,
    ubicacion,
    canal_origen,
    created_by,
    clave_idempotencia,
    huella_contenido
  )
  values (
    v_asunto,
    v_descripcion,
    p_categoria_id,
    v_solicitante_nombre,
    v_solicitante_tipo,
    v_ubicacion,
    v_canal_origen,
    p_actor_id,
    v_clave,
    v_huella
  )
  on conflict (clave_idempotencia) do nothing
  returning * into v_ticket;

  if not found then
    select *
    into v_existente
    from public.tickets t
    where t.clave_idempotencia = v_clave
    for update;

    if not found then
      raise exception using errcode = 'P0001', message = 'internal_error';
    end if;

    if v_existente.created_by is distinct from p_actor_id
      or v_existente.huella_contenido is distinct from v_huella then
      raise exception using errcode = 'P0001', message = 'duplicate_request_conflict';
    end if;

    return v_existente;
  end if;

  insert into public.ticket_historial (
    ticket_id,
    accion,
    estado_anterior,
    estado_nuevo,
    actor_id,
    detalle
  )
  values (
    v_ticket.id,
    'creado',
    null,
    'nuevo',
    p_actor_id,
    null
  );

  return v_ticket;
end;
$$;

comment on function private.registrar_ticket is
  'Núcleo de creación con actor explícito. Reservado a servidores autorizados.';

revoke all on function private.registrar_ticket(
  uuid, text, text, uuid, text, text, text, text, text
) from public;
revoke all on function private.registrar_ticket(
  uuid, text, text, uuid, text, text, text, text, text
) from anon;
revoke all on function private.registrar_ticket(
  uuid, text, text, uuid, text, text, text, text, text
) from authenticated;
grant execute on function private.registrar_ticket(
  uuid, text, text, uuid, text, text, text, text, text
) to service_role;

-- Creación desde una sesión de técnico. El actor y el creador se derivan de
-- auth.uid(); el cliente no puede suplantarlos.
create or replace function public.crear_ticket(
  p_asunto text,
  p_descripcion text,
  p_categoria_id uuid,
  p_solicitante_nombre text,
  p_solicitante_tipo text,
  p_ubicacion text default null,
  p_canal_origen text default 'manual',
  p_clave_idempotencia text default null
)
returns public.tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'no_autenticado';
  end if;

  if not public.is_active_technician() then
    raise exception using errcode = '42501', message = 'perfil_inactivo';
  end if;

  return private.registrar_ticket(
    v_actor,
    p_asunto,
    p_descripcion,
    p_categoria_id,
    p_solicitante_nombre,
    p_solicitante_tipo,
    p_ubicacion,
    p_canal_origen,
    p_clave_idempotencia
  );
end;
$$;

comment on function public.crear_ticket is
  'Crea un ticket en estado nuevo, sin técnico asignado, con actor derivado de la sesión.';

revoke all on function public.crear_ticket(
  text, text, uuid, text, text, text, text, text
) from public;
revoke all on function public.crear_ticket(
  text, text, uuid, text, text, text, text, text
) from anon;
grant execute on function public.crear_ticket(
  text, text, uuid, text, text, text, text, text
) to authenticated;

-- Toma del ticket: asigna el técnico actual sin cambiar todavía el estado.
-- La fila se bloquea para impedir que dos técnicos lo tomen a la vez.
create or replace function public.tomar_ticket(p_ticket_id uuid)
returns public.tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_ticket public.tickets;
  v_estado_anterior text;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'no_autenticado';
  end if;

  if not public.is_active_technician() then
    raise exception using errcode = '42501', message = 'perfil_inactivo';
  end if;

  select *
  into v_ticket
  from public.tickets
  where id = p_ticket_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'ticket_no_encontrado';
  end if;

  if v_ticket.estado not in ('nuevo', 'reabierto') then
    raise exception using errcode = 'P0001', message = 'transicion_invalida';
  end if;

  if v_ticket.tecnico_asignado_id is not null then
    if v_ticket.tecnico_asignado_id = v_actor then
      return v_ticket;
    end if;

    raise exception using errcode = 'P0001', message = 'ticket_ya_tomado';
  end if;

  v_estado_anterior := v_ticket.estado;

  update public.tickets
  set tecnico_asignado_id = v_actor
  where id = p_ticket_id
  returning * into v_ticket;

  insert into public.ticket_historial (
    ticket_id,
    accion,
    estado_anterior,
    estado_nuevo,
    actor_id,
    detalle
  )
  values (
    v_ticket.id,
    'tomado',
    v_estado_anterior,
    v_ticket.estado,
    v_actor,
    null
  );

  return v_ticket;
end;
$$;

comment on function public.tomar_ticket is
  'Asigna el ticket al técnico actual. Rechaza la toma simultánea por otro técnico.';

revoke all on function public.tomar_ticket(uuid) from public;
revoke all on function public.tomar_ticket(uuid) from anon;
grant execute on function public.tomar_ticket(uuid) to authenticated;

-- Inicio de la atención. Solo el técnico asignado puede iniciarla.
create or replace function public.iniciar_atencion(p_ticket_id uuid)
returns public.tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_ticket public.tickets;
  v_estado_anterior text;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'no_autenticado';
  end if;

  if not public.is_active_technician() then
    raise exception using errcode = '42501', message = 'perfil_inactivo';
  end if;

  select *
  into v_ticket
  from public.tickets
  where id = p_ticket_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'ticket_no_encontrado';
  end if;

  if v_ticket.estado = 'en_atencion' and v_ticket.tecnico_asignado_id = v_actor then
    return v_ticket;
  end if;

  if v_ticket.estado not in ('nuevo', 'reabierto') then
    raise exception using errcode = 'P0001', message = 'transicion_invalida';
  end if;

  if v_ticket.tecnico_asignado_id is distinct from v_actor then
    raise exception using errcode = 'P0001', message = 'sin_asignacion';
  end if;

  v_estado_anterior := v_ticket.estado;

  update public.tickets
  set
    estado = 'en_atencion',
    fecha_inicio_atencion = now()
  where id = p_ticket_id
  returning * into v_ticket;

  insert into public.ticket_historial (
    ticket_id,
    accion,
    estado_anterior,
    estado_nuevo,
    actor_id,
    detalle
  )
  values (
    v_ticket.id,
    'iniciado',
    v_estado_anterior,
    'en_atencion',
    v_actor,
    null
  );

  return v_ticket;
end;
$$;

comment on function public.iniciar_atencion is
  'Pasa el ticket asignado a en_atencion y registra la fecha de inicio.';

revoke all on function public.iniciar_atencion(uuid) from public;
revoke all on function public.iniciar_atencion(uuid) from anon;
grant execute on function public.iniciar_atencion(uuid) to authenticated;

-- Resolución del ticket. La solución es obligatoria y solo puede registrarla
-- el técnico asignado.
create or replace function public.resolver_ticket(
  p_ticket_id uuid,
  p_solucion text
)
returns public.tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_ticket public.tickets;
  v_estado_anterior text;
  v_solucion text := btrim(coalesce(p_solucion, ''));
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'no_autenticado';
  end if;

  if not public.is_active_technician() then
    raise exception using errcode = '42501', message = 'perfil_inactivo';
  end if;

  select *
  into v_ticket
  from public.tickets
  where id = p_ticket_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'ticket_no_encontrado';
  end if;

  if v_ticket.estado <> 'en_atencion' then
    raise exception using errcode = 'P0001', message = 'transicion_invalida';
  end if;

  if v_ticket.tecnico_asignado_id is distinct from v_actor then
    raise exception using errcode = 'P0001', message = 'sin_asignacion';
  end if;

  if char_length(v_solucion) < 5 then
    raise exception using errcode = 'P0001', message = 'solucion_requerida';
  end if;

  if char_length(v_solucion) > 4000 then
    raise exception using errcode = 'P0001', message = 'datos_invalidos';
  end if;

  v_estado_anterior := v_ticket.estado;

  update public.tickets
  set
    estado = 'resuelto',
    solucion = v_solucion,
    fecha_resolucion = now(),
    fecha_cierre = null
  where id = p_ticket_id
  returning * into v_ticket;

  insert into public.ticket_historial (
    ticket_id,
    accion,
    estado_anterior,
    estado_nuevo,
    actor_id,
    detalle
  )
  values (
    v_ticket.id,
    'resuelto',
    v_estado_anterior,
    'resuelto',
    v_actor,
    v_solucion
  );

  return v_ticket;
end;
$$;

comment on function public.resolver_ticket is
  'Resuelve el ticket con una solución obligatoria y registra el historial.';

revoke all on function public.resolver_ticket(uuid, text) from public;
revoke all on function public.resolver_ticket(uuid, text) from anon;
grant execute on function public.resolver_ticket(uuid, text) to authenticated;

-- Cierre del ticket resuelto. Solo lo confirma el técnico asignado.
create or replace function public.cerrar_ticket(p_ticket_id uuid)
returns public.tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_ticket public.tickets;
  v_estado_anterior text;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'no_autenticado';
  end if;

  if not public.is_active_technician() then
    raise exception using errcode = '42501', message = 'perfil_inactivo';
  end if;

  select *
  into v_ticket
  from public.tickets
  where id = p_ticket_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'ticket_no_encontrado';
  end if;

  if v_ticket.estado = 'cerrado' and v_ticket.tecnico_asignado_id = v_actor then
    return v_ticket;
  end if;

  if v_ticket.estado <> 'resuelto' then
    raise exception using errcode = 'P0001', message = 'transicion_invalida';
  end if;

  if v_ticket.tecnico_asignado_id is distinct from v_actor then
    raise exception using errcode = 'P0001', message = 'sin_asignacion';
  end if;

  v_estado_anterior := v_ticket.estado;

  update public.tickets
  set
    estado = 'cerrado',
    fecha_cierre = now()
  where id = p_ticket_id
  returning * into v_ticket;

  insert into public.ticket_historial (
    ticket_id,
    accion,
    estado_anterior,
    estado_nuevo,
    actor_id,
    detalle
  )
  values (
    v_ticket.id,
    'cerrado',
    v_estado_anterior,
    'cerrado',
    v_actor,
    null
  );

  return v_ticket;
end;
$$;

comment on function public.cerrar_ticket is
  'Cierra un ticket resuelto y registra la fecha de cierre.';

revoke all on function public.cerrar_ticket(uuid) from public;
revoke all on function public.cerrar_ticket(uuid) from anon;
grant execute on function public.cerrar_ticket(uuid) to authenticated;

-- Reapertura. Devuelve el ticket a la cola sin técnico asignado y conserva la
-- solución anterior en el historial. Cualquier técnico activo puede reabrirlo.
create or replace function public.reabrir_ticket(
  p_ticket_id uuid,
  p_motivo text default null
)
returns public.tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_ticket public.tickets;
  v_estado_anterior text;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'no_autenticado';
  end if;

  if not public.is_active_technician() then
    raise exception using errcode = '42501', message = 'perfil_inactivo';
  end if;

  select *
  into v_ticket
  from public.tickets
  where id = p_ticket_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'ticket_no_encontrado';
  end if;

  if v_ticket.estado not in ('resuelto', 'cerrado') then
    raise exception using errcode = 'P0001', message = 'transicion_invalida';
  end if;

  if v_motivo is not null and char_length(v_motivo) > 1000 then
    raise exception using errcode = 'P0001', message = 'datos_invalidos';
  end if;

  v_estado_anterior := v_ticket.estado;

  update public.tickets
  set
    estado = 'reabierto',
    tecnico_asignado_id = null,
    fecha_inicio_atencion = null,
    fecha_resolucion = null,
    fecha_cierre = null
  where id = p_ticket_id
  returning * into v_ticket;

  insert into public.ticket_historial (
    ticket_id,
    accion,
    estado_anterior,
    estado_nuevo,
    actor_id,
    detalle
  )
  values (
    v_ticket.id,
    'reabierto',
    v_estado_anterior,
    'reabierto',
    v_actor,
    v_motivo
  );

  return v_ticket;
end;
$$;

comment on function public.reabrir_ticket is
  'Reabre un ticket resuelto o cerrado, lo devuelve a la cola y conserva la solución previa en el historial.';

revoke all on function public.reabrir_ticket(uuid, text) from public;
revoke all on function public.reabrir_ticket(uuid, text) from anon;
grant execute on function public.reabrir_ticket(uuid, text) to authenticated;
