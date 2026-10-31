-- Pruebas de integración para la operación compartida del Área TI.
--
-- No se ejecutan automáticamente ni contra producción. Requieren un Supabase
-- local o staging autorizado, con las migraciones aplicadas en orden. El
-- script trabaja dentro de una transacción y termina con ROLLBACK, por lo que
-- no deja cuentas, tickets ni categorías de prueba.
--
-- Uso:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f supabase/tests/20261029100000_shared_admin_ticket_operations.test.sql
--
-- Las cuentas y los datos son sintéticos.

\set ON_ERROR_STOP on

begin;

-- Cuentas sintéticas de Auth. Los perfiles se crean explícitamente después.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated', 'admin-a@test.invalid', '',
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated', 'admin-b@test.invalid', '',
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated', 'authenticated', 'admin-inactivo@test.invalid', '',
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '44444444-4444-4444-4444-444444444444',
    'authenticated', 'authenticated', 'tecnico@test.invalid', '',
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now()
  )
on conflict (id) do nothing;

insert into public.profiles (id, nombres, apellidos, rol, activo)
values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'A', 'admin', true),
  ('22222222-2222-2222-2222-222222222222', 'Admin', 'B', 'admin', true),
  ('33333333-3333-3333-3333-333333333333', 'Admin', 'Inactivo', 'admin', false),
  ('44444444-4444-4444-4444-444444444444', 'Técnico', 'Legado', 'tecnico', true)
on conflict (id) do update
set rol = excluded.rol,
    activo = excluded.activo,
    nombres = excluded.nombres,
    apellidos = excluded.apellidos;

do $$
declare
  v_admin_a uuid := '11111111-1111-1111-1111-111111111111';
  v_admin_b uuid := '22222222-2222-2222-2222-222222222222';
  v_admin_inactivo uuid := '33333333-3333-3333-3333-333333333333';
  v_tecnico uuid := '44444444-4444-4444-4444-444444444444';
  v_categoria uuid;
  v_categoria_reporte uuid;
  v_ticket public.tickets;
  v_repetido public.tickets;
  v_ticket_a uuid;
  v_ticket_b uuid;
  v_actor uuid;
  v_total integer;
  v_reporte jsonb;
  v_fallo boolean;
begin
  select id into v_categoria
  from public.catalogo_categorias
  where lower(btrim(nombre)) = 'hardware'
  limit 1;

  if v_categoria is null then
    raise exception 'Falta la categoría Hardware de las migraciones base.';
  end if;

  -- 1. Un admin activo crea el ticket y queda auditado con su sesión.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin_a, 'role', 'authenticated')::text,
    true
  );

  v_ticket := public.crear_ticket(
    'Equipo no enciende',
    'El equipo del laboratorio no enciende al pulsar el botón.',
    v_categoria,
    'Ana Pérez',
    'docente',
    'Laboratorio 2',
    'manual',
    'integracion-clave-1'
  );

  if v_ticket.estado <> 'nuevo' then
    raise exception 'La creación debe dejar el ticket en nuevo.';
  end if;

  if v_ticket.tecnico_asignado_id is not null then
    raise exception 'La creación no debe asignar un técnico.';
  end if;

  select actor_id into v_actor
  from public.ticket_historial
  where ticket_id = v_ticket.id and accion = 'creado';

  if v_actor is distinct from v_admin_a then
    raise exception 'El evento creado debe usar el actor de la sesión.';
  end if;

  -- 2. El reintento con la misma clave devuelve el mismo ticket.
  v_repetido := public.crear_ticket(
    'Equipo no enciende',
    'El equipo del laboratorio no enciende al pulsar el botón.',
    v_categoria,
    'Ana Pérez',
    'docente',
    'Laboratorio 2',
    'manual',
    'integracion-clave-1'
  );

  if v_repetido.id <> v_ticket.id then
    raise exception 'El reintento idempotente duplicó el ticket.';
  end if;

  select count(*) into v_total
  from public.tickets
  where clave_idempotencia = 'integracion-clave-1';

  if v_total <> 1 then
    raise exception 'La clave de idempotencia debe producir un solo ticket.';
  end if;

  -- 3. Reutilizar la clave con otro contenido debe fallar.
  v_fallo := false;
  begin
    perform public.crear_ticket(
      'Otro asunto distinto',
      'El contenido cambió respecto del primer intento.',
      v_categoria,
      'Ana Pérez',
      'docente',
      'Laboratorio 2',
      'manual',
      'integracion-clave-1'
    );
  exception when others then
    if sqlerrm = 'duplicate_request_conflict' then
      v_fallo := true;
    else
      raise;
    end if;
  end;

  if not v_fallo then
    raise exception 'La reutilización de clave con otro contenido no fue rechazada.';
  end if;

  -- 4. La clave de idempotencia respeta el máximo de 200 caracteres.
  v_fallo := false;
  begin
    perform public.crear_ticket(
      'Asunto de prueba',
      'Descripción suficientemente larga para la validación.',
      v_categoria,
      'Ana Pérez',
      'docente',
      null,
      'manual',
      repeat('x', 201)
    );
  exception when others then
    if sqlerrm = 'datos_invalidos' then
      v_fallo := true;
    else
      raise;
    end if;
  end;

  if not v_fallo then
    raise exception 'La clave de idempotencia mayor a 200 caracteres no fue rechazada.';
  end if;

  -- 5. Un perfil admin inactivo no puede operar.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin_inactivo, 'role', 'authenticated')::text,
    true
  );

  v_fallo := false;
  begin
    perform public.iniciar_atencion(v_ticket.id);
  exception when others then
    if sqlerrm = 'perfil_inactivo' then
      v_fallo := true;
    else
      raise;
    end if;
  end;

  if not v_fallo then
    raise exception 'Un admin inactivo no debe poder iniciar la atención.';
  end if;

  -- 6. Cualquier admin activo inicia, resuelve y cierra, sin asignación previa.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin_b, 'role', 'authenticated')::text,
    true
  );

  v_ticket := public.iniciar_atencion(v_ticket.id);

  if v_ticket.estado <> 'en_atencion' or v_ticket.fecha_inicio_atencion is null then
    raise exception 'El inicio de atención no quedó registrado.';
  end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin_a, 'role', 'authenticated')::text,
    true
  );

  v_ticket := public.resolver_ticket(
    v_ticket.id,
    'Se reinició el equipo y se verificó el arranque.'
  );

  if v_ticket.estado <> 'resuelto' or v_ticket.fecha_resolucion is null then
    raise exception 'La resolución no quedó registrada.';
  end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin_b, 'role', 'authenticated')::text,
    true
  );

  v_ticket := public.cerrar_ticket(v_ticket.id);

  if v_ticket.estado <> 'cerrado' or v_ticket.fecha_cierre is null then
    raise exception 'El cierre no quedó registrado.';
  end if;

  -- 7. La reapertura limpia el ciclo y conserva la solución anterior.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin_a, 'role', 'authenticated')::text,
    true
  );

  v_ticket := public.reabrir_ticket(v_ticket.id, 'Reapareció el mismo fallo.');

  if v_ticket.estado <> 'reabierto' then
    raise exception 'La reapertura no devolvió el ticket a reabierto.';
  end if;

  if v_ticket.fecha_inicio_atencion is not null
    or v_ticket.fecha_resolucion is not null
    or v_ticket.fecha_cierre is not null then
    raise exception 'La reapertura debe limpiar las fechas del ciclo anterior.';
  end if;

  if v_ticket.solucion is null then
    raise exception 'La reapertura no debe borrar la solución anterior.';
  end if;

  v_ticket := public.iniciar_atencion(v_ticket.id);
  v_ticket := public.resolver_ticket(v_ticket.id, 'Se reemplazó la fuente de poder.');
  v_ticket := public.cerrar_ticket(v_ticket.id);

  select count(*) into v_total
  from public.ticket_historial
  where ticket_id = v_ticket.id and accion = 'resuelto';

  if v_total <> 2 then
    raise exception 'El historial debe conservar ambos ciclos de resolución.';
  end if;

  -- 8. Reporte: fixture con fechas controladas y una categoría aislada.
  insert into public.catalogo_categorias (nombre, descripcion)
  values ('Categoría de prueba de reporte', 'Fixture sintético de integración.')
  returning id into v_categoria_reporte;

  insert into public.tickets (
    asunto, descripcion, categoria_id, solicitante_nombre,
    solicitante_tipo, estado, solucion, fecha_creacion,
    fecha_inicio_atencion, fecha_resolucion, created_by
  )
  values (
    'Ticket con reapertura',
    'Fixture para promedios del ciclo vigente.',
    v_categoria_reporte, 'Solicitante docente', 'docente', 'resuelto',
    'Solución vigente del segundo ciclo.', now() - interval '10 days',
    now() - interval '6 days', now() - interval '5 days', v_admin_a
  )
  returning id into v_ticket_a;

  insert into public.ticket_historial (
    ticket_id, accion, estado_anterior, estado_nuevo, actor_id, creado_en
  )
  values
    (v_ticket_a, 'creado', null, 'nuevo', v_admin_a, now() - interval '10 days'),
    (v_ticket_a, 'iniciado', 'nuevo', 'en_atencion', v_admin_a, now() - interval '9 days'),
    (v_ticket_a, 'resuelto', 'en_atencion', 'resuelto', v_admin_a, now() - interval '8 days'),
    (v_ticket_a, 'reabierto', 'resuelto', 'reabierto', v_admin_a, now() - interval '7 days'),
    (v_ticket_a, 'iniciado', 'reabierto', 'en_atencion', v_admin_a, now() - interval '6 days'),
    (v_ticket_a, 'resuelto', 'en_atencion', 'resuelto', v_admin_a, now() - interval '5 days');

  -- Creado fuera del periodo, resuelto dentro: prueba el conteo por evento real.
  insert into public.tickets (
    asunto, descripcion, categoria_id, solicitante_nombre,
    solicitante_tipo, estado, solucion, fecha_creacion,
    fecha_inicio_atencion, fecha_resolucion, created_by
  )
  values (
    'Ticket antiguo resuelto en el periodo',
    'Fixture para el conteo por fecha real de resolución.',
    v_categoria_reporte, 'Solicitante docente', 'docente', 'resuelto',
    'Solución del ticket antiguo.', now() - interval '20 days',
    now() - interval '19 days', now() - interval '2 days', v_admin_a
  )
  returning id into v_ticket_b;

  insert into public.ticket_historial (
    ticket_id, accion, estado_anterior, estado_nuevo, actor_id, creado_en
  )
  values
    (v_ticket_b, 'creado', null, 'nuevo', v_admin_a, now() - interval '20 days'),
    (v_ticket_b, 'iniciado', 'nuevo', 'en_atencion', v_admin_a, now() - interval '19 days'),
    (v_ticket_b, 'resuelto', 'en_atencion', 'resuelto', v_admin_a, now() - interval '2 days');

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin_a, 'role', 'authenticated')::text,
    true
  );

  v_reporte := public.obtener_reporte_eficiencia(
    (current_date - 12),
    current_date,
    v_categoria_reporte,
    'docente'
  );

  if (v_reporte #>> '{resumen,recibidos}')::integer <> 1 then
    raise exception 'El reporte debe contar solo el ticket creado dentro del periodo.';
  end if;

  if (v_reporte #>> '{resumen,resueltos}')::integer <> 2 then
    raise exception 'El reporte debe contar las resoluciones reales del periodo.';
  end if;

  if (v_reporte #>> '{resumen,reabiertos}')::integer <> 1 then
    raise exception 'El reporte debe contar la reapertura del periodo.';
  end if;

  -- Ciclo vigente tras la reapertura: inicio 1 día y resolución 2 días.
  if (v_reporte #>> '{resumen,tiempo_inicio_minutos}')::numeric <> 1440 then
    raise exception 'El promedio de inicio mezcló ciclos anteriores.';
  end if;

  if (v_reporte #>> '{resumen,tiempo_resolucion_minutos}')::numeric <> 2880 then
    raise exception 'El promedio de resolución mezcló ciclos anteriores.';
  end if;

  -- 100.0 fuerza la división decimal; el resultado cruza el periodo.
  if (v_reporte #>> '{resumen,tasa_resolucion}')::numeric <> 200 then
    raise exception 'La tasa de resolución no usa división decimal.';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(v_reporte -> 'evolucion') as punto
    where punto ->> 'periodo' = 'diaria'
      and (punto ->> 'recibidos')::integer = 0
      and (punto ->> 'resueltos')::integer = 1
  ) then
    raise exception 'La evolución no refleja resoluciones sin creación en el mismo día.';
  end if;

  -- 9. El reporte está restringido a admin activo.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_tecnico, 'role', 'authenticated')::text,
    true
  );

  v_fallo := false;
  begin
    perform public.obtener_reporte_eficiencia();
  exception when others then
    if sqlerrm = 'solo_admin' then
      v_fallo := true;
    else
      raise;
    end if;
  end;

  if not v_fallo then
    raise exception 'Un técnico no debe acceder al reporte de administración.';
  end if;

  -- 10. Filtros inválidos del reporte.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin_a, 'role', 'authenticated')::text,
    true
  );

  v_fallo := false;
  begin
    perform public.obtener_reporte_eficiencia(
      current_date, current_date - 1, null, null
    );
  exception when others then
    if sqlerrm = 'datos_invalidos' then
      v_fallo := true;
    else
      raise;
    end if;
  end;

  if not v_fallo then
    raise exception 'Un rango de fechas invertido no fue rechazado.';
  end if;

  v_fallo := false;
  begin
    perform public.obtener_reporte_eficiencia(
      null, null, null, 'tipo-inexistente'
    );
  exception when others then
    if sqlerrm = 'datos_invalidos' then
      v_fallo := true;
    else
      raise;
    end if;
  end;

  if not v_fallo then
    raise exception 'Un tipo de solicitante inválido no fue rechazado.';
  end if;

  -- 11. Contratos de permisos y RLS declarados.
  if has_function_privilege(
    'anon',
    'public.obtener_reporte_eficiencia(date,date,uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'anon no debe ejecutar el reporte.';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.obtener_reporte_eficiencia(date,date,uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'authenticated debe poder invocar el reporte (con control interno).';
  end if;

  if has_table_privilege('anon', 'public.tickets', 'SELECT')
    or has_table_privilege('anon', 'public.ticket_historial', 'SELECT')
    or has_table_privilege('anon', 'public.catalogo_categorias', 'SELECT') then
    raise exception 'anon no debe tener privilegios de lectura sobre las tablas del módulo.';
  end if;

  if to_regprocedure('public.tomar_ticket(uuid)') is not null then
    raise exception 'La RPC obsoleta tomar_ticket sigue existiendo.';
  end if;

  if not has_function_privilege(
    'service_role',
    'private.registrar_ticket(uuid,text,text,uuid,text,text,text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'service_role debe conservar el núcleo privado de creación.';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and cmd <> 'SELECT'
  ) then
    raise exception 'No deben existir políticas RLS de escritura directa.';
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('profiles','catalogo_categorias','tickets','ticket_historial')
      and not c.relrowsecurity
  ) then
    raise exception 'Todas las tablas del módulo deben mantener RLS activo.';
  end if;

  raise notice 'OK: operación compartida, transiciones, idempotencia y reporte verificados.';
end;
$$;

-- 12. Comprobación de acceso directo: anon no puede leer tickets.
set local role anon;

do $$
begin
  begin
    perform 1 from public.tickets limit 1;
    raise exception 'anon no debe poder leer public.tickets.';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;

-- 13. Comprobación RLS: un admin activo sí puede leer tickets e historial.
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
  )::text,
  true
);

set local role authenticated;

do $$
begin
  if not exists (select 1 from public.tickets) then
    raise exception 'El admin activo no puede leer tickets con RLS.';
  end if;

  if not exists (select 1 from public.ticket_historial) then
    raise exception 'El admin activo no puede leer el historial con RLS.';
  end if;
end;
$$;

reset role;

rollback;
