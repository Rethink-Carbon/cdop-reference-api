-- 0006: issuances, unit blocks, unit history, transfers, retirements, cancellations, buffer pool, unit labels.

create table cdop.issuance (
  id text primary key,
  project_id text not null references cdop.project(id) on delete cascade,
  batch_identifier text not null unique,
  sequence int not null,
  kind text not null check (kind in ('ex_ante','ex_post','conversion','buffer')),
  verification_event_id text references cdop.verification_event(id),
  validation_event_id text references cdop.validation_event(id),
  status text not null check (status in ('Verified','Pending Issuance','Issuing','Pre-issuance','Failed','Complete')),
  issued_on date,
  requested_on date,
  unit_type text not null,
  unit_class text not null check (unit_class in ('credit','pending','buffer')),
  metric text not null default 'tCO2e',
  vintage_start_on date not null,
  vintage_end_on date not null,
  vintage_label text not null,
  volume numeric(16,2) not null,
  cumulative_volume numeric(16,2) not null,
  recipient_account_id text references cdop.account(id),
  url text,
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  version int not null default 1,
  unique (project_id, sequence)
);
create index issuance_project_idx on cdop.issuance (project_id, issued_on);
create index issuance_modified_idx on cdop.issuance (modified_at, id);
create trigger issuance_touch before update on cdop.issuance for each row execute function cdop.touch_modified();
create trigger issuance_touch_project after insert or update or delete on cdop.issuance for each row execute function cdop.touch_project();
alter table cdop.verification_event add constraint verification_event_issuance_fk
  foreign key (issuance_id) references cdop.issuance(id);

create table cdop.unit_block (
  id text primary key,
  project_id text not null references cdop.project(id) on delete cascade,
  issuance_id text not null references cdop.issuance(id),
  serial_number text not null unique,
  source_block_id text references cdop.unit_block(id),
  block_start bigint not null,
  block_end bigint not null,
  quantity bigint generated always as (block_end - block_start + 1) stored,
  unit_type text not null,
  unit_class text not null check (unit_class in ('credit','pending','buffer')),
  metric text not null default 'tCO2e',
  vintage_start_on date not null,
  vintage_end_on date not null,
  vintage_label text not null,
  owner_account_id text not null references cdop.account(id),
  state text not null check (state in ('pending','active','on_hold','buffer','retired','cancelled','expired')),
  state_reason text,
  native_status_code text,
  native_status_name text,
  cdop_status text not null,                   -- projection onto CDOP unit.status enum
  retirement_id text,
  cancellation_id text,
  labels_cached text[] not null default '{}',
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  version int not null default 1,
  check (block_end >= block_start),
  exclude using gist (project_id with =, unit_type with =, int8range(block_start, block_end, '[]') with &&)
);
create index unit_block_owner_idx on cdop.unit_block (owner_account_id, state);
create index unit_block_project_idx on cdop.unit_block (project_id, vintage_start_on);
create index unit_block_issuance_idx on cdop.unit_block (issuance_id);
create index unit_block_modified_idx on cdop.unit_block (modified_at, id);
create trigger unit_block_touch before update on cdop.unit_block for each row execute function cdop.touch_modified();
create trigger unit_block_touch_project after insert or update or delete on cdop.unit_block for each row execute function cdop.touch_project();

create table cdop.unit_status_history (
  id text primary key,
  block_id text not null references cdop.unit_block(id) on delete cascade,
  project_id text not null references cdop.project(id) on delete cascade,
  sequence int not null,
  from_state text,
  to_state text not null,
  cdop_status text not null,
  action text not null,
  reason text,
  actor_kind text not null check (actor_kind in ('developer','code_admin','vvb','registry','system','simulator','db','buyer')),
  actor_account_id text references cdop.account(id),
  from_owner_account_id text references cdop.account(id),
  to_owner_account_id text references cdop.account(id),
  quantity bigint,
  effective_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  is_current boolean not null default false,
  event_id text,
  unique (block_id, sequence)
);
create unique index unit_status_current_idx on cdop.unit_status_history (block_id) where is_current;
create index unit_status_project_idx on cdop.unit_status_history (project_id, effective_at);

create table cdop.transfer (
  id text primary key,
  project_id text not null references cdop.project(id) on delete cascade,
  block_id text not null references cdop.unit_block(id),
  kind text not null check (kind in ('assignment','transfer','sale')),
  from_account_id text not null references cdop.account(id),
  to_account_id text not null references cdop.account(id),
  quantity bigint not null,
  price numeric(12,2),
  currency text,
  status text not null check (status in ('pending','accepted','rejected','cancelled')),
  requested_at timestamptz not null,
  settled_at timestamptz,
  remarks text,
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  version int not null default 1
);
create index transfer_project_idx on cdop.transfer (project_id, requested_at);
create index transfer_block_idx on cdop.transfer (block_id);
create trigger transfer_touch before update on cdop.transfer for each row execute function cdop.touch_modified();
create trigger transfer_touch_project after insert or update or delete on cdop.transfer for each row execute function cdop.touch_project();

create table cdop.retirement (
  id text primary key,
  project_id text not null references cdop.project(id) on delete cascade,
  block_id text not null references cdop.unit_block(id),
  account_id text not null references cdop.account(id),
  quantity bigint not null,
  retired_at timestamptz not null,
  beneficiary_name text,
  beneficiary_organisation_id text references cdop.organisation(id),
  purpose text check (purpose in ('voluntary_offset','compliance','corsia','article_6','claim_neutrality','other')),
  detail text,
  vintage_label text not null,
  certificate_document_id text,
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  version int not null default 1
);
create index retirement_project_idx on cdop.retirement (project_id, retired_at);
create trigger retirement_touch before update on cdop.retirement for each row execute function cdop.touch_modified();
create trigger retirement_touch_project after insert or update or delete on cdop.retirement for each row execute function cdop.touch_project();
alter table cdop.unit_block add constraint unit_block_retirement_fk foreign key (retirement_id) references cdop.retirement(id);

create table cdop.cancellation (
  id text primary key,
  project_id text not null references cdop.project(id) on delete cascade,
  block_id text not null references cdop.unit_block(id),
  account_id text references cdop.account(id),
  quantity bigint not null,
  cancelled_at timestamptz not null,
  reason text not null check (reason in ('reversal','error','conversion','transfer_out','voluntary','expiry','regulatory')),
  detail text,
  replacement_block_id text references cdop.unit_block(id),
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  version int not null default 1
);
create index cancellation_project_idx on cdop.cancellation (project_id, cancelled_at);
create trigger cancellation_touch before update on cdop.cancellation for each row execute function cdop.touch_modified();
create trigger cancellation_touch_project after insert or update or delete on cdop.cancellation for each row execute function cdop.touch_project();
alter table cdop.unit_block add constraint unit_block_cancellation_fk foreign key (cancellation_id) references cdop.cancellation(id);

create table cdop.buffer_pool_entry (
  id text primary key,
  project_id text not null references cdop.project(id) on delete cascade,
  standard_id text not null references cdop.standard(id),
  kind text not null check (kind in ('deposit','release','reversal_coverage','reversal_non_coverage','cancellation')),
  quantity numeric(16,2) not null,
  occurred_on date not null,
  block_id text references cdop.unit_block(id),
  verification_event_id text references cdop.verification_event(id),
  notes text
);
create index buffer_pool_entry_project_idx on cdop.buffer_pool_entry (project_id);
create trigger buffer_pool_entry_touch_project after insert or update or delete on cdop.buffer_pool_entry for each row execute function cdop.touch_project();

create view cdop.buffer_pool_balance as
  select project_id, standard_id,
    coalesce(sum(quantity) filter (where kind = 'deposit'), 0) as deposits,
    coalesce(sum(quantity) filter (where kind = 'release'), 0) as releases,
    coalesce(sum(quantity) filter (where kind = 'reversal_coverage'), 0) as reversal_coverage,
    coalesce(sum(quantity) filter (where kind = 'reversal_non_coverage'), 0) as reversal_non_coverage
  from cdop.buffer_pool_entry group by project_id, standard_id;

create table cdop.unit_label (
  block_id text not null references cdop.unit_block(id) on delete cascade,
  label_id text not null references cdop.label(id),
  kind text not null check (kind in ('accreditation','compliance_eligibility','compliance_potential')),
  accreditation_id text,
  start_on date,
  expiry_on date,
  approved_on date,
  url text,
  primary key (block_id, label_id, kind)
);
