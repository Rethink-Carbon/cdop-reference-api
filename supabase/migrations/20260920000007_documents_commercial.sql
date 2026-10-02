-- 0007: documents, agreements, co-benefits.

create table cdop.document (
  id text primary key,
  project_id text not null references cdop.project(id) on delete cascade,
  document_type_id text not null references cdop.document_type(id),
  validation_event_id text references cdop.validation_event(id),
  verification_event_id text references cdop.verification_event(id),
  issuance_id text references cdop.issuance(id),
  title text not null,
  file_name text not null,
  content_type text not null default 'application/pdf',
  size_bytes int,
  url text,
  is_public boolean not null default true,
  uploaded_at timestamptz not null,
  uploaded_by_account_id text references cdop.account(id),
  document_date date,
  version_label text,
  sha256 text,
  extracted jsonb not null default '{}'::jsonb check (jsonb_typeof(extracted) = 'object'),
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  version int not null default 1
);
create index document_project_idx on cdop.document (project_id, uploaded_at);
create index document_type_idx on cdop.document (document_type_id);
create trigger document_touch before update on cdop.document for each row execute function cdop.touch_modified();
create trigger document_touch_project after insert or update or delete on cdop.document for each row execute function cdop.touch_project();
alter table cdop.validation_event add constraint validation_report_document_fk foreign key (report_document_id) references cdop.document(id);
alter table cdop.validation_event add constraint validation_statement_document_fk foreign key (statement_document_id) references cdop.document(id);
alter table cdop.verification_event add constraint verification_report_document_fk foreign key (report_document_id) references cdop.document(id);
alter table cdop.verification_event add constraint verification_statement_document_fk foreign key (statement_document_id) references cdop.document(id);
alter table cdop.retirement add constraint retirement_certificate_document_fk foreign key (certificate_document_id) references cdop.document(id);

create table cdop.agreement (
  id text primary key,
  project_id text not null references cdop.project(id) on delete cascade,
  agreement_type text not null,
  notes text,
  currency text,
  commitment_amount numeric(16,2),
  effective_on date,
  expiry_on date,
  governing_law text,
  financing_stage text,
  marketplace_or_venue text[] not null default '{}',
  collateral_type text[] not null default '{}',
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  version int not null default 1
);
create index agreement_project_idx on cdop.agreement (project_id);
create trigger agreement_touch before update on cdop.agreement for each row execute function cdop.touch_modified();
create trigger agreement_touch_project after insert or update or delete on cdop.agreement for each row execute function cdop.touch_project();

create table cdop.agreement_offtake (
  id text primary key,
  agreement_id text not null references cdop.agreement(id) on delete cascade,
  contracted_volume bigint,
  contracted_price numeric(12,2),
  vintage_start_year int,
  vintage_end_year int,
  requirements text
);

create table cdop.agreement_insurance (
  id text primary key,
  agreement_id text not null references cdop.agreement(id) on delete cascade,
  policy_exists boolean not null,
  insurer_name text,
  policy_reference text,
  coverage_type text
);

create table cdop.agreement_funding (
  id text primary key,
  agreement_id text not null references cdop.agreement(id) on delete cascade,
  sequence int not null,
  source_category text not null,
  expected_disbursement_on date,
  disbursement_schedule text,
  conditions_precedent text,
  is_fully_committed boolean,
  commitment_status text,
  status_reason text,
  is_current boolean not null default false,
  unique (agreement_id, sequence)
);

create table cdop.agreement_counterparty (
  agreement_id text not null references cdop.agreement(id) on delete cascade,
  organisation_id text not null references cdop.organisation(id),
  role text not null,
  sector text,
  primary key (agreement_id, organisation_id, role)
);

create table cdop.cobenefit_target (
  id text primary key,
  project_id text not null references cdop.project(id) on delete cascade,
  cobenefit_type text not null,
  indicator_id text not null,
  impact_overview text,
  approach text,
  unit_description text,
  unit_type text,
  unit_symbol text,
  monitoring_frequency text,
  baseline_value text,
  target_value text,
  supporting_evidence_url text,
  unique (project_id, indicator_id)
);

create table cdop.cobenefit_impact (
  id text primary key,
  target_id text not null references cdop.cobenefit_target(id) on delete cascade,
  project_id text not null references cdop.project(id) on delete cascade,
  verification_event_id text references cdop.verification_event(id),
  achieved_impact text,
  achieved_value text,
  change_type text,
  supporting_evidence_url text,
  reported_on date
);

create table cdop.cobenefit_method (
  project_id text not null references cdop.project(id) on delete cascade,
  method text not null,
  sort int not null default 0,
  primary key (project_id, method)
);
