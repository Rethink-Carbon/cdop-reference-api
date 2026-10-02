-- 0005: validation, verification, estimation, milestones.

create table cdop.validation_event (
  id text primary key,
  project_id text not null references cdop.project(id) on delete cascade,
  sequence int not null,
  validation_type text not null,
  status text not null check (status in ('planned','submitted','in_review','changes_requested','completed','rejected','expired','withdrawn')),
  vvb_organisation_id text references cdop.organisation(id),
  vvb_account_id text references cdop.account(id),
  submitted_on date,
  site_visit_start_on date,
  site_visit_end_on date,
  decided_on date,
  opinion text check (opinion in ('positive','qualified','negative')),
  crediting_period_id text references cdop.crediting_period(id),
  report_document_id text,
  statement_document_id text,
  report_url text,
  expires_on date,
  notes text,
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  version int not null default 1,
  unique (project_id, sequence)
);
create index validation_event_project_idx on cdop.validation_event (project_id);
create trigger validation_event_touch before update on cdop.validation_event for each row execute function cdop.touch_modified();
create trigger validation_event_touch_project after insert or update or delete on cdop.validation_event for each row execute function cdop.touch_project();
alter table cdop.crediting_period add constraint crediting_period_validation_fk
  foreign key (validation_event_id) references cdop.validation_event(id);

-- Verification as a first-class event: reporting period, verified quantity, explicit deductions.
create table cdop.verification_event (
  id text primary key,
  project_id text not null references cdop.project(id) on delete cascade,
  sequence int not null,
  monitoring_period_start_on date not null,
  monitoring_period_end_on date not null,
  status text not null check (status in ('planned','submitted','in_review','changes_requested','completed','rejected','withdrawn')),
  vvb_organisation_id text references cdop.organisation(id),
  site_visit_start_on date,
  site_visit_end_on date,
  submitted_on date,
  verified_on date,
  opinion text check (opinion in ('positive','qualified','negative')),
  claim_type text not null default 'CARBON_REMOVAL',
  uom text not null default 'tCO2e',
  predicted_quantity numeric(16,2),
  claimed_quantity numeric(16,2),
  gross_verified_quantity numeric(16,2),
  leakage_deduction numeric(16,2) not null default 0,
  buffer_deduction numeric(16,2) not null default 0,
  uncertainty_deduction numeric(16,2) not null default 0,
  uncertainty_basis text check (uncertainty_basis in ('percentage','absolute')),
  uncertainty_margin numeric(7,4),
  verified_quantity numeric(16,2) generated always as
    (coalesce(gross_verified_quantity, 0) - leakage_deduction - buffer_deduction - uncertainty_deduction) stored,
  cumulative_verified_quantity numeric(16,2),
  issuance_id text,
  report_document_id text,
  statement_document_id text,
  report_url text,
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  version int not null default 1,
  unique (project_id, sequence),
  check (monitoring_period_end_on >= monitoring_period_start_on)
);
create index verification_event_project_idx on cdop.verification_event (project_id);
create trigger verification_event_touch before update on cdop.verification_event for each row execute function cdop.touch_modified();
create trigger verification_event_touch_project after insert or update or delete on cdop.verification_event for each row execute function cdop.touch_project();

create table cdop.estimation (
  id text primary key,
  project_id text not null references cdop.project(id) on delete cascade,
  sequence int not null,
  event_on date not null,
  status text not null check (status in ('Unvalidated','Validated','Superseded')),
  status_reason text,
  validated_by_validation_event_id text references cdop.validation_event(id),
  superseded_by_estimation_id text references cdop.estimation(id),
  total_mitigation numeric(16,2),
  annual_mitigation numeric(14,2),
  total_years int,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  version int not null default 1,
  unique (project_id, sequence)
);
create unique index estimation_current_idx on cdop.estimation (project_id) where is_current;
create trigger estimation_touch before update on cdop.estimation for each row execute function cdop.touch_modified();
create trigger estimation_touch_project after insert or update or delete on cdop.estimation for each row execute function cdop.touch_project();

create table cdop.estimation_vintage (
  id text primary key,
  estimation_id text not null references cdop.estimation(id) on delete cascade,
  project_id text not null references cdop.project(id) on delete cascade,
  vintage_start_on date not null,
  vintage_end_on date not null,
  vintage_year int not null,
  estimated_mitigation numeric(16,2) not null,
  estimated_claimable numeric(16,2),
  estimated_buffer numeric(16,2),
  monitoring_start_on date,
  monitoring_end_on date,
  estimated_issuance_on date,
  unique (estimation_id, vintage_start_on)
);
create index estimation_vintage_project_idx on cdop.estimation_vintage (project_id);

create table cdop.milestone (
  id text primary key,
  project_id text not null references cdop.project(id) on delete cascade,
  kind text not null check (kind in ('validation_due','validation_expiry','verification_due','monitoring_report_due',
    'crediting_period_end','restoration_validation_due','self_assessment_due','other')),
  name text not null,
  sequence int not null default 0,
  due_on date not null,
  completed_at timestamptz,
  completed_by_validation_event_id text references cdop.validation_event(id),
  completed_by_verification_event_id text references cdop.verification_event(id),
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  version int not null default 1,
  unique (project_id, name)
);
create index milestone_due_idx on cdop.milestone (due_on) where completed_at is null;
create trigger milestone_touch before update on cdop.milestone for each row execute function cdop.touch_modified();
create trigger milestone_touch_project after insert or update or delete on cdop.milestone for each row execute function cdop.touch_project();
