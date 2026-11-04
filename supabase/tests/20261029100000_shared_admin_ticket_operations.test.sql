-- Pruebas de integración para la operación compartida del Área TI.
--
-- Se ejecutan con `supabase test db` (pgTAP) o con psql dentro de una
-- transacción. No se ejecutan automáticamente ni contra producción. Requieren
-- un Supabase local o staging autorizado, con las migraciones aplicadas en
-- orden. El script trabaja dentro de una transacción y termina con ROLLBACK,
-- por lo que no deja cuentas, tickets ni categorías de prueba.
--
-- Uso:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f supabase/tests/20261029100000_shared_admin_ticket_operations.test.sql
--
-- Las cuentas y los datos son sintéticos.

\set ON_ERROR_STOP on

begin;

-- pgTAP puede estar instalado en el esquema public o extensions del entorno local.
create extension if not exists pgtap;
set local search_path = public, extensions;

-- Acumula las líneas TAP para emitirlas al final desde una sola consulta.
-- Las aserciones se ejecutan dentro de bloques DO porque el escenario requiere
-- bloques PL/pgSQL con captura de errores; `ok()` devuelve la línea TAP y el
-- bloque la guarda para no perder el resultado.
create temp table tap_results (
  orden serial primary key,
  linea text not null
) on commit drop;

select plan(46);

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

  insert into tap_results (linea) values (
    ok(v_ticket.estado = 'nuevo', 'La creación deja el ticket en estado nuevo')
  );

  insert into tap_results (linea) values (
    ok(v_ticket.tecnico_asignado_id is null, 'La creación no asigna un técnico')
  );

  select actor_id into v_actor
  from public.ticket_historial
  where ticket_id = v_ticket.id and accion = 'creado';

  insert into tap_results (linea) values (
    ok(v_actor is not distinct from v_admin_a, 'El evento creado usa el actor de la sesión')
  );

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

  insert into tap_results (linea) values (
    ok(v_repetido.id = v_ticket.id, 'El reintento idempotente devuelve el mismo ticket')
  );

  select count(*) into v_total
  from public.tickets
  where clave_idempotencia = 'integracion-clave-1';

  insert into tap_results (linea) values (
    ok(v_total = 1, 'La clave de idempotencia produce un solo ticket')
  );

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

  insert into tap_results (linea) values (
    ok(v_fallo, 'La reutilización de la clave con otro contenido es rechazada')
  );

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

  insert into tap_results (linea) values (
    ok(v_fallo, 'La clave de idempotencia mayor a 200 caracteres es rechazada')
  );

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

  insert into tap_results (linea) values (
    ok(v_fallo, 'Un admin inactivo no puede iniciar la atención')
  );

  -- 6. Cualquier admin activo inicia, resuelve y cierra, sin asignación previa.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin_b, 'role', 'authenticated')::text,
    true
  );

  v_ticket := public.iniciar_atencion(v_ticket.id);

  insert into tap_results (linea) values (
    ok(
      v_ticket.estado = 'en_atencion' and v_ticket.fecha_inicio_atencion is not null,
      'El inicio de atención queda registrado'
    )
  );

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin_a, 'role', 'authenticated')::text,
    true
  );

  v_ticket := public.resolver_ticket(
    v_ticket.id,
    'Se reinició el equipo y se verificó el arranque.'
  );

  insert into tap_results (linea) values (
    ok(
      v_ticket.estado = 'resuelto' and v_ticket.fecha_resolucion is not null,
      'La resolución queda registrada'
    )
  );

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin_b, 'role', 'authenticated')::text,
    true
  );

  v_ticket := public.cerrar_ticket(v_ticket.id);

  insert into tap_results (linea) values (
    ok(
      v_ticket.estado = 'cerrado' and v_ticket.fecha_cierre is not null,
      'El cierre queda registrado'
    )
  );

  -- 7. La reapertura limpia el ciclo y conserva la solución anterior.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin_a, 'role', 'authenticated')::text,
    true
  );

  v_ticket := public.reabrir_ticket(v_ticket.id, 'Reapareció el mismo fallo.');

  insert into tap_results (linea) values (
    ok(v_ticket.estado = 'reabierto', 'La reapertura devuelve el ticket a reabierto')
  );

  insert into tap_results (linea) values (
    ok(
      v_ticket.fecha_inicio_atencion is null
        and v_ticket.fecha_resolucion is null
        and v_ticket.fecha_cierre is null,
      'La reapertura limpia las fechas del ciclo anterior'
    )
  );

  insert into tap_results (linea) values (
    ok(v_ticket.solucion is not null, 'La reapertura no borra la solución anterior')
  );

  v_ticket := public.iniciar_atencion(v_ticket.id);
  v_ticket := public.resolver_ticket(v_ticket.id, 'Se reemplazó la fuente de poder.');
  v_ticket := public.cerrar_ticket(v_ticket.id);

  select count(*) into v_total
  from public.ticket_historial
  where ticket_id = v_ticket.id and accion = 'resuelto';

  insert into tap_results (linea) values (
    ok(v_total = 2, 'El historial conserva ambos ciclos de resolución')
  );

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

  insert into tap_results (linea) values (
    ok(
      (v_reporte #>> '{resumen,recibidos}')::integer = 1,
      'El reporte cuenta solo el ticket creado dentro del periodo'
    )
  );

  insert into tap_results (linea) values (
    ok(
      (v_reporte #>> '{resumen,resueltos}')::integer = 2,
      'El reporte cuenta las resoluciones reales del periodo'
    )
  );

  insert into tap_results (linea) values (
    ok(
      (v_reporte #>> '{resumen,reabiertos}')::integer = 1,
      'El reporte cuenta la reapertura del periodo'
    )
  );

  -- Ciclo vigente tras la reapertura: inicio 1 día y resolución 2 días.
  insert into tap_results (linea) values (
    ok(
      (v_reporte #>> '{resumen,tiempo_inicio_minutos}')::numeric = 1440,
      'El promedio de inicio usa solo el ciclo vigente tras la reapertura'
    )
  );

  insert into tap_results (linea) values (
    ok(
      (v_reporte #>> '{resumen,tiempo_resolucion_minutos}')::numeric = 2880,
      'El promedio de resolución usa solo el ciclo vigente tras la reapertura'
    )
  );

  -- 100.0 fuerza la división decimal; el resultado cruza el periodo.
  insert into tap_results (linea) values (
    ok(
      (v_reporte #>> '{resumen,tasa_resolucion}')::numeric = 200,
      'La tasa de resolución usa división decimal'
    )
  );

  insert into tap_results (linea) values (
    ok(
      exists (
        select 1
        from jsonb_array_elements(v_reporte -> 'evolucion') as punto
        where punto ->> 'periodo' = 'diaria'
          and (punto ->> 'recibidos')::integer = 0
          and (punto ->> 'resueltos')::integer = 1
      ),
      'La evolución refleja resoluciones sin creación en el mismo día'
    )
  );

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

  insert into tap_results (linea) values (
    ok(v_fallo, 'Un técnico no accede al reporte de administración')
  );

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

  insert into tap_results (linea) values (
    ok(v_fallo, 'Un rango de fechas invertido es rechazado')
  );

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

  insert into tap_results (linea) values (
    ok(v_fallo, 'Un tipo de solicitante inválido es rechazado')
  );

  -- 11. Contratos de permisos y RLS declarados.
  insert into tap_results (linea) values (
    ok(
      not has_function_privilege(
        'anon',
        'public.obtener_reporte_eficiencia(date,date,uuid,text)',
        'EXECUTE'
      ),
      'anon no ejecuta el reporte de eficiencia'
    )
  );

  insert into tap_results (linea) values (
    ok(
      has_function_privilege(
        'authenticated',
        'public.obtener_reporte_eficiencia(date,date,uuid,text)',
        'EXECUTE'
      ),
      'authenticated puede invocar el reporte con control interno'
    )
  );

  insert into tap_results (linea) values (
    ok(
      not (
        has_table_privilege('anon', 'public.tickets', 'SELECT')
        or has_table_privilege('anon', 'public.ticket_historial', 'SELECT')
        or has_table_privilege('anon', 'public.catalogo_categorias', 'SELECT')
      ),
      'anon no tiene privilegios de lectura sobre las tablas del módulo'
    )
  );

  insert into tap_results (linea) values (
    ok(
      to_regprocedure('public.tomar_ticket(uuid)') is null,
      'La RPC obsoleta tomar_ticket no existe'
    )
  );

  insert into tap_results (linea) values (
    ok(
      has_function_privilege(
        'service_role',
        'private.registrar_ticket(uuid,text,text,uuid,text,text,text,text,text)',
        'EXECUTE'
      ),
      'service_role conserva el núcleo privado de creación'
    )
  );

  insert into tap_results (linea) values (
    ok(
      not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and cmd <> 'SELECT'
      ),
      'No existen políticas RLS de escritura directa'
    )
  );

  insert into tap_results (linea) values (
    ok(
      not exists (
        select 1
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname in ('profiles','catalogo_categorias','tickets','ticket_historial')
          and not c.relrowsecurity
      ),
      'Todas las tablas del módulo mantienen RLS activo'
    )
  );
end;
$$;

-- 12. Restricciones NOT VALID: protegen filas nuevas sin validar históricos.
do $$
declare
  v_docente uuid;
  v_correo text := 'docente.' || replace(gen_random_uuid()::text, '-', '') || '@ottotonsman.edu.pe';
  v_ticket uuid;
  v_fallo boolean;
begin
  insert into public.catalogo_docentes (nombre_completo, correo_institucional)
  values ('Docente Sintético', v_correo)
  returning id into v_docente;

  insert into tap_results (linea) values (
    ok(v_docente is not null, 'La restricción de correo acepta un docente nuevo válido')
  );

  v_fallo := false;
  begin
    insert into public.catalogo_docentes (nombre_completo, correo_institucional)
    values ('Docente Inválido', 'docente@dominio-externo.test');
  exception when check_violation then
    v_fallo := true;
  end;

  insert into tap_results (linea) values (
    ok(v_fallo, 'La restricción NOT VALID de correo rechaza un docente nuevo inválido')
  );

  insert into public.tickets (asunto, descripcion, categoria_id, solicitante_nombre, solicitante_tipo)
  select 'Ticket de restricción', 'Ticket sintético para probar el historial.', id, 'Solicitante', 'docente'
  from public.catalogo_categorias
  where lower(btrim(nombre)) = 'hardware'
  returning id into v_ticket;

  v_fallo := false;
  begin
    insert into public.ticket_historial (ticket_id, accion, estado_anterior, estado_nuevo, actor_id)
    values (v_ticket, 'iniciado', 'nuevo', 'en_atencion', null);
  exception when check_violation then
    v_fallo := true;
  end;

  insert into tap_results (linea) values (
    ok(v_fallo, 'La restricción NOT VALID de actor rechaza un evento nuevo sin actor')
  );

  v_fallo := false;
  begin
    insert into public.ticket_historial (ticket_id, accion, estado_anterior, estado_nuevo, actor_id, detalle)
    values (v_ticket, 'creado', null, 'nuevo', null, 'Detalle distinto al del formulario público.');
  exception when check_violation then
    v_fallo := true;
  end;

  insert into tap_results (linea) values (
    ok(v_fallo, 'La restricción NOT VALID de actor rechaza un evento público con detalle no canónico')
  );

  insert into tap_results (linea) values (
    ok(
      (select not convalidated from pg_constraint
        where conrelid = 'public.ticket_historial'::regclass
          and conname = 'ticket_historial_actor_requerido_ck')
        and (select not convalidated from pg_constraint
          where conrelid = 'public.catalogo_docentes'::regclass
            and conname = 'catalogo_docentes_correo_ck'),
      'Las restricciones quedan NOT VALID para conservar el historial existente'
    )
  );
end;
$$;

-- 13. service_role conserva la creación pública y el núcleo privado.
do $$
declare
  v_docente uuid;
  v_pabellon uuid;
  v_piso uuid;
  v_ambiente uuid;
  v_falla uuid;
  v_correo text := 'docente.publico.' || replace(gen_random_uuid()::text, '-', '') || '@ottotonsman.edu.pe';
begin
  insert into public.catalogo_docentes (nombre_completo, correo_institucional)
  values ('Docente Público Sintético', v_correo)
  returning id into v_docente;

  insert into public.catalogo_pabellones (nombre)
  values ('Pabellón ' || replace(gen_random_uuid()::text, '-', ''))
  returning id into v_pabellon;

  insert into public.catalogo_pisos (pabellon_id, nombre)
  values (v_pabellon, 'Piso ' || replace(gen_random_uuid()::text, '-', ''))
  returning id into v_piso;

  insert into public.catalogo_ambientes (piso_id, nombre)
  values (v_piso, 'Ambiente ' || replace(gen_random_uuid()::text, '-', ''))
  returning id into v_ambiente;

  select f.id into v_falla
  from public.catalogo_fallas_comunes f
  join public.catalogo_fallas_solicitante s on s.falla_id = f.id
  where s.solicitante_tipo = 'docente' and f.activo
  limit 1;

  if v_falla is null then
    raise exception 'Falta una falla activa para docente.';
  end if;

  perform set_config('test.public_docente_id', v_docente::text, true);
  perform set_config('test.public_docente_correo', v_correo, true);
  perform set_config('test.public_falla_id', v_falla::text, true);
  perform set_config('test.public_ambiente_id', v_ambiente::text, true);
  perform set_config('test.public_clave', 'pgtap-public-' || replace(gen_random_uuid()::text, '-', ''), true);
  perform set_config('test.admin_a', '11111111-1111-1111-1111-111111111111', true);
  perform set_config(
    'test.categoria_hardware',
    (select id::text from public.catalogo_categorias where lower(btrim(nombre)) = 'hardware' limit 1),
    true
  );
end;
$$;

set local role service_role;

do $$
declare
  v_numero text;
begin
  select numero_ticket into v_numero
  from public.registrar_ticket_publico(
    'docente',
    '',
    null,
    '',
    current_setting('test.public_docente_id')::uuid,
    null,
    current_setting('test.public_falla_id')::uuid,
    current_setting('test.public_ambiente_id')::uuid,
    null,
    'Reporte sintético para verificar la resolución del correo docente.',
    current_setting('test.public_clave'),
    repeat('b', 64)
  );

  perform set_config('test.public_ok', 'true', true);
  perform set_config('test.public_numero', v_numero, true);
exception when others then
  perform set_config('test.public_ok', 'false', true);
  perform set_config('test.public_error', sqlerrm, true);
end;
$$;

do $$
declare
  v_ticket public.tickets;
begin
  v_ticket := private.registrar_ticket(
    current_setting('test.admin_a')::uuid,
    'Creación privada de prueba',
    'Verifica que service_role conserve el núcleo privado.',
    current_setting('test.categoria_hardware')::uuid,
    'Solicitante Sintético',
    'docente',
    null,
    'manual',
    'pgtap-private-' || replace(gen_random_uuid()::text, '-', '')
  );

  perform set_config('test.private_ok', (v_ticket.id is not null)::text, true);
exception when others then
  perform set_config('test.private_ok', 'false', true);
  perform set_config('test.private_error', sqlerrm, true);
end;
$$;

reset role;

insert into tap_results (linea) values (
  ok(
    current_setting('test.public_ok', true) = 'true',
    'service_role conserva la creación pública de tickets'
      || coalesce(': ' || current_setting('test.public_error', true), '')
  )
);

do $$
declare
  v_correo text;
  v_nombre text;
  v_evento_ok boolean;
begin
  select t.solicitante_correo, t.solicitante_nombre,
    exists (
      select 1
      from public.ticket_historial h
      where h.ticket_id = t.id
        and h.accion = 'creado'
        and h.actor_id is null
        and h.detalle = 'Reporte público recibido mediante formulario web.'
    )
  into v_correo, v_nombre, v_evento_ok
  from public.tickets t
  where t.numero_ticket = current_setting('test.public_numero', true);

  insert into tap_results (linea) values (
    ok(
      coalesce(
        v_correo = current_setting('test.public_docente_correo', true)
          and v_nombre = 'Docente Público Sintético',
        false
      ),
      'La RPC pública resuelve nombre y correo del docente en servidor'
    )
  );

  insert into tap_results (linea) values (
    ok(coalesce(v_evento_ok, false), 'El evento público inicial con actor nulo cumple la restricción')
  );
end;
$$;

insert into tap_results (linea) values (
  ok(
    current_setting('test.private_ok', true) = 'true',
    'La creación privada sigue funcionando para service_role'
      || coalesce(': ' || current_setting('test.private_error', true), '')
  )
);

insert into tap_results (linea) values (
  ok(
    has_table_privilege('service_role', 'public.tickets', 'SELECT')
      and has_table_privilege('service_role', 'public.ticket_historial', 'SELECT')
      and not has_table_privilege('service_role', 'public.tickets', 'INSERT')
      and not has_table_privilege('service_role', 'public.tickets', 'UPDATE')
      and not has_table_privilege('service_role', 'public.tickets', 'DELETE')
      and not has_table_privilege('service_role', 'public.ticket_historial', 'INSERT')
      and not has_table_privilege('service_role', 'public.ticket_historial', 'UPDATE')
      and not has_table_privilege('service_role', 'public.ticket_historial', 'DELETE'),
    'service_role solo lee tickets e historial y no escribe directamente'
  )
);

set local role service_role;

do $$
declare
  v_denegado boolean := false;
begin
  begin
    insert into public.tickets (asunto, descripcion, categoria_id, solicitante_nombre, solicitante_tipo)
    select 'Intento directo', 'service_role no debe escribir directamente.', id, 'Sintético', 'docente'
    from public.catalogo_categorias
    limit 1;
  exception when insufficient_privilege then
    v_denegado := true;
  end;

  perform set_config('test.service_role_insert_denied', v_denegado::text, true);
end;
$$;

reset role;

insert into tap_results (linea) values (
  ok(
    current_setting('test.service_role_insert_denied', true) = 'true',
    'service_role no puede insertar tickets directamente'
  )
);

-- 14. Comprobación de acceso directo: anon no puede leer tickets.
-- El resultado se guarda en una configuración local porque el rol anon no
-- tiene acceso al esquema extensions para invocar ok() directamente.
set local role anon;

do $$
declare
  v_denegado boolean := false;
begin
  begin
    perform 1 from public.tickets limit 1;
  exception when insufficient_privilege then
    v_denegado := true;
  end;

  perform set_config('test.anon_tickets_denegado', v_denegado::text, true);
end;
$$;

reset role;

insert into tap_results (linea) values (
  ok(
    current_setting('test.anon_tickets_denegado', true) = 'true',
    'anon no puede leer public.tickets por privilegio insuficiente'
  )
);

-- 15. Comprobación RLS: un admin activo sí puede leer tickets e historial.
do $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', '11111111-1111-1111-1111-111111111111',
      'role', 'authenticated'
    )::text,
    true
  );
end;
$$;

set local role authenticated;

do $$
begin
  perform set_config(
    'test.admin_lee_tickets',
    (exists (select 1 from public.tickets))::text,
    true
  );

  perform set_config(
    'test.admin_lee_historial',
    (exists (select 1 from public.ticket_historial))::text,
    true
  );
end;
$$;

reset role;

insert into tap_results (linea) values (
  ok(
    current_setting('test.admin_lee_tickets', true) = 'true',
    'El admin activo puede leer tickets con RLS'
  )
);

insert into tap_results (linea) values (
  ok(
    current_setting('test.admin_lee_historial', true) = 'true',
    'El admin activo puede leer el historial con RLS'
  )
);

select linea from tap_results order by orden;
select * from finish();

rollback;
