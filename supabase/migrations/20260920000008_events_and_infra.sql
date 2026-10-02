-- 0008: event outbox, API infrastructure tables, simulator state, row-event triggers, NOTIFY.

create table cdop.event (
  sequence bigint generated always as identity primary key,
  id text not null unique,
  specversion text not null default '1.0',
  type text not null,
  source text not null,
  subject text not null,
  subject_type text not null,
  project_id text references cdop.project(id) on delete cascade,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  origin text not null check (origin in ('api','simulator','seed','db')),
  actor_kind text,
  actor_account_id text,
  correlation_id text,
  causation_id text,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  dedupe_key text unique,
  xact_id xid8 not null default pg_current_xact_id()
);
create index event_project_seq_idx on cdop.event (project_id, sequence);
create index event_type_seq_idx on cdop.event (type, sequence);
create index event_occurred_idx on cdop.event (occurred_at);
create index event_subject_idx on cdop.event (subject, sequence);

create table cdop.api_key (
  id text primary key,
  key_hash text not null unique,
  role text not null check (role in ('developer','vvb','code_admin','registry','admin','sandbox')),
  label text not null,
  account_id text references cdop.account(id),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create table cdop.idempotency_key (
  key text not null,
  api_key_id text not null,
  request_hash text not null,
  status int,
  response jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (api_key_id, key)
);

create table cdop.webhook (
  id text primary key,
  url text not null,
  secret_hash text not null,
  types text[] not null default '{}',
  project_id text references cdop.project(id) on delete cascade,
  description text,
  is_enabled boolean not null default true,
  consecutive_failures int not null default 0,
  owner_api_key_id text references cdop.api_key(id),
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  version int not null default 1
);
create trigger webhook_touch before update on cdop.webhook for each row execute function cdop.touch_modified();

create table cdop.webhook_delivery (
  id text primary key,
  webhook_id text not null references cdop.webhook(id) on delete cascade,
  event_sequence bigint not null references cdop.event(sequence) on delete cascade,
  attempt int not null default 0,
  status text not null check (status in ('pending','delivering','delivered','failed','abandoned')),
  next_attempt_at timestamptz not null default now(),
  last_response_status int,
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);
create index webhook_delivery_claim_idx on cdop.webhook_delivery (next_attempt_at) where status in ('pending','failed');

create table cdop.sim_config (
  id boolean primary key default true check (id),
  is_running boolean not null default false,
  tick_seconds int not null default 60,
  actions_per_tick int not null default 3,
  speed numeric(6,2) not null default 1.0,
  seed text not null default '2026',
  tick_no bigint not null default 0,
  last_tick_at timestamptz,
  paused_reason text,
  modified_at timestamptz not null default now()
);
insert into cdop.sim_config default values;

create table cdop.sim_run (
  id bigint generated always as identity primary key,
  tick_no bigint not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  actions jsonb not null default '[]'::jsonb,
  error text
);

-- Fan-out: notify listeners with the sequence; they re-read the row.
create or replace function cdop.notify_event() returns trigger language plpgsql as $$
begin
  perform pg_notify('cdop_events', json_build_object('sequence', new.sequence, 'type', new.type, 'project_id', new.project_id)::text);
  return new;
end $$;
create trigger event_notify after insert on cdop.event for each row execute function cdop.notify_event();

-- Row-level change capture for edits made outside the API (Studio, psql). Suppressed by the
-- API/seed/simulator, which write richer semantic events themselves.
create or replace function cdop.emit_row_event() returns trigger language plpgsql as $$
declare
  changed jsonb := '{}'::jsonb;
  row_id text;
  pid text;
  op text := lower(tg_op);
begin
  if current_setting('cdop.suppress_row_events', true) = 'on' then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(o.key, jsonb_build_array(o.value, n.value)), '{}'::jsonb) into changed
      from jsonb_each(to_jsonb(old)) o join jsonb_each(to_jsonb(new)) n using (key)
      where o.value is distinct from n.value and o.key not in ('modified_at', 'version');
    if changed = '{}'::jsonb then return new; end if;
  end if;
  row_id := coalesce(to_jsonb(coalesce(new, old))->>'id', to_jsonb(coalesce(new, old))->>'project_id');
  pid := case when tg_table_name = 'project' then row_id else to_jsonb(coalesce(new, old))->>'project_id' end;
  if pid is not null and not exists (select 1 from cdop.project where id = pid) then
    pid := null;
  end if;
  insert into cdop.event (id, type, source, subject, subject_type, project_id, occurred_at, origin, data)
  values (
    'evt_' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 26)),
    'org.cdop.row.changed',
    '/db/' || tg_table_name,
    coalesce(row_id, tg_table_name),
    tg_table_name,
    pid,
    now(),
    'db',
    jsonb_build_object('op', op, 'table', tg_table_name, 'changed', changed,
      'row', case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['project','project_status_history','unit_block','issuance','transfer','retirement',
    'cancellation','document','milestone','validation_event','verification_event','account','geolocation_file','estimation']
  loop
    execute format('create trigger %I_row_event after insert or update or delete on cdop.%I for each row execute function cdop.emit_row_event()', t, t);
  end loop;
end $$;

-- Keep denormalised project state coherent when someone edits the row directly.
create or replace function cdop.project_state_sync() returns trigger language plpgsql as $$
declare ns record; nextseq int;
begin
  if current_setting('cdop.suppress_row_events', true) = 'on' then return new; end if;
  if new.native_state_code is distinct from old.native_state_code then
    select * into ns from cdop.native_state where standard_id = new.standard_id and code = new.native_state_code;
    if found then
      new.lifecycle_state := ns.lifecycle_state;
      new.cdop_project_status := ns.cdop_project_status;
      new.native_state_name := ns.name;
    end if;
    select coalesce(max(sequence), 0) + 1 into nextseq from cdop.project_status_history where project_id = new.id;
    update cdop.project_status_history set is_current = false where project_id = new.id and is_current;
    insert into cdop.project_status_history (id, project_id, sequence, lifecycle_state, native_state_code, native_state_name,
      cdop_project_status, action, intent, reason, actor_kind, effective_at, is_current)
    values ('psh_' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 26)), new.id, nextseq, new.lifecycle_state,
      new.native_state_code, new.native_state_name, new.cdop_project_status, 'DB_EDIT', 'other', 'Edited directly in the database',
      'db', now(), true);
  end if;
  return new;
end $$;
create trigger project_state_sync before update of native_state_code on cdop.project for each row execute function cdop.project_state_sync();
