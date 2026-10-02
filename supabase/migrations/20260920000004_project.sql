-- 0004: project core.

create table cdop.project (
  id text primary key,
  project_identifier text not null unique,     -- URN 'cdop:<registry>:<native id>'
  registry_id text not null references cdop.registry(id),
  standard_id text not null references cdop.standard(id),
  standard_version_id text references cdop.standard_version(id),
  crediting_program_id text not null references cdop.crediting_program(id),
  methodology_version_id text references cdop.methodology_version(id),
  native_project_id text not null,
  native_project_url text,
  name text not null,
  description text,
  program_type text check (program_type in ('Standalone project','Nested project','Scaled up program')),
  activity_type text,
  master_project_id text references cdop.project(id),
  developer_account_id text references cdop.account(id),
  developer_organisation_id text references cdop.organisation(id),
  vvb_organisation_id text references cdop.organisation(id),
  lifecycle_state text not null check (lifecycle_state in
    ('draft','listed','registered','validated','verified','retired','withdrawn','rejected')),
  native_state_code text not null,
  native_state_name text,
  cdop_project_status text not null,
  is_on_hold boolean not null default false,
  listed_on date,
  registered_on date,
  validated_on date,
  first_verified_on date,
  closed_on date,
  validation_deadline_on date,
  country_code text not null,                  -- alpha-3
  country_name text not null,
  region_code text not null,                   -- UN M49
  region_name text not null,
  subdivision_code text,
  subdivision_name text,
  city text,
  centroid_lat numeric(9,6),
  centroid_lon numeric(9,6),
  min_lon numeric(9,6), min_lat numeric(9,6), max_lon numeric(9,6), max_lat numeric(9,6),
  grid_reference text,
  area_ha numeric(12,2),
  start_on date,
  end_on date,
  duration_years int,
  crediting_period_type text check (crediting_period_type in ('Fixed','Renewable')),
  max_cumulative_crediting_years int,
  max_crediting_periods int,
  estimated_annual_mitigation numeric(14,2),
  estimated_total_mitigation numeric(16,2),
  estimated_total_years int,
  buffer_rate numeric(5,4),
  unit_metric text not null default 'tCO2e' check (unit_metric in ('tCO2e','tCO2')),
  attestations jsonb not null default '{}'::jsonb check (jsonb_typeof(attestations) = 'object'),
  governance_structure text,
  community_frameworks text,
  public_comment boolean,
  public_comment_summary text,
  previous_program boolean,
  project_risk jsonb check (project_risk is null or jsonb_typeof(project_risk) = 'object'),
  native_attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(native_attributes) = 'object'),
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  version int not null default 1,
  unique (registry_id, native_project_id)
);
create index project_modified_idx on cdop.project (modified_at, id);
create index project_standard_state_idx on cdop.project (standard_id, lifecycle_state);
create index project_country_idx on cdop.project (country_code);
create index project_master_idx on cdop.project (master_project_id);
create index project_name_idx on cdop.project (lower(name));
create trigger project_touch before update on cdop.project for each row execute function cdop.touch_modified();

create table cdop.project_location (
  id text primary key,
  project_id text not null references cdop.project(id) on delete cascade,
  kind text not null check (kind in ('project','facility')),
  is_primary boolean not null default false,
  country_code text not null,
  country_name text not null,
  region_code text not null,
  region_name text not null,
  subdivision_code text,
  subdivision_name text,
  address_line_1 text,
  address_line_2 text,
  alternative_address text,
  city text,
  postal_code text,
  sort int not null default 0
);
create index project_location_project_idx on cdop.project_location (project_id);

create table cdop.project_mitigation (
  id text primary key,
  project_id text not null references cdop.project(id) on delete cascade,
  mitigation_type text not null,
  project_sector text not null,
  project_type text not null,
  estimated_annual_mitigation numeric(14,2) not null,
  estimated_total_mitigation numeric(16,2) not null,
  sort int not null default 0
);
create index project_mitigation_project_idx on cdop.project_mitigation (project_id);

-- The versioned status record: one row per change, native + CDOP + canonical vocabularies.
create table cdop.project_status_history (
  id text primary key,
  project_id text not null references cdop.project(id) on delete cascade,
  sequence int not null,
  lifecycle_state text not null,
  native_state_code text not null,
  native_state_name text,
  cdop_project_status text not null,
  action text,
  intent text,
  reason text,
  actor_kind text not null check (actor_kind in ('developer','code_admin','vvb','registry','system','simulator','db')),
  actor_account_id text references cdop.account(id),
  effective_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  is_current boolean not null default false,
  event_id text,
  unique (project_id, sequence)
);
create unique index project_status_current_idx on cdop.project_status_history (project_id) where is_current;
create index project_status_effective_idx on cdop.project_status_history (project_id, effective_at);

create table cdop.crediting_period (
  id text primary key,
  project_id text not null references cdop.project(id) on delete cascade,
  number int not null,
  start_on date not null,
  end_on date not null,
  duration_years int not null,
  period_type text not null check (period_type in ('Fixed','Renewable')),
  validation_event_id text,
  is_current boolean not null default false,
  unique (project_id, number)
);

create table cdop.geolocation_file (
  id text primary key,
  project_id text not null references cdop.project(id) on delete cascade,
  file_name text not null,
  file_format text not null check (file_format in ('GeoJSON','KML','Shapefile')),
  area_type text not null,
  geometry_type text not null check (geometry_type in ('Polygon','MultiPolygon')),
  file_status text not null check (file_status in ('ACTIVE','ARCHIVED','ACQUIRED','CANCELLED','FAILED','PLANNED','POTENTIAL','REJECTED')),
  validity_start_on date not null,
  validity_end_on date,
  file_created_at timestamptz not null,
  file_edited_at timestamptz,
  file_deleted_at timestamptz,
  crs text not null default 'EPSG:4326',
  geojson jsonb not null check (jsonb_typeof(geojson) = 'object'),
  area_ha numeric(12,2),
  min_lon numeric(9,6) not null, min_lat numeric(9,6) not null, max_lon numeric(9,6) not null, max_lat numeric(9,6) not null,
  sha256 text,
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  version int not null default 1
);
create index geolocation_file_project_idx on cdop.geolocation_file (project_id);
create index geolocation_file_bbox_idx on cdop.geolocation_file (min_lon, min_lat, max_lon, max_lat);
create trigger geolocation_file_touch before update on cdop.geolocation_file for each row execute function cdop.touch_modified();

create table cdop.project_finance (
  project_id text primary key references cdop.project(id) on delete cascade,
  expected_initial_costs numeric(16,2),
  expected_annual_costs numeric(16,2),
  expected_annual_revenue numeric(16,2),
  total_funding_required numeric(16,2),
  total_funding_secured numeric(16,2),
  financing_options text[] not null default '{}',
  community_benefit_mechanisms text[] not null default '{}',
  expected_community_proceeds numeric(16,2),
  declaring_entity_organisation_id text references cdop.organisation(id),
  expected_credit_price numeric(12,2),
  realized_transaction_price numeric(12,2),
  currency text
);

create table cdop.project_sdg (
  project_id text not null references cdop.project(id) on delete cascade,
  sdg_number int not null check (sdg_number between 1 and 17),
  primary key (project_id, sdg_number)
);

create table cdop.project_stakeholder (
  id text primary key,
  project_id text not null references cdop.project(id) on delete cascade,
  organisation_id text not null references cdop.organisation(id),
  stakeholder_type text not null,
  is_primary_developer boolean not null default false,
  role_started_on date,
  role_ended_on date,
  unique (project_id, organisation_id, stakeholder_type)
);
create index project_stakeholder_project_idx on cdop.project_stakeholder (project_id);

create table cdop.project_label (
  id text primary key,
  project_id text not null references cdop.project(id) on delete cascade,
  label_id text not null references cdop.label(id),
  kind text not null check (kind in ('accreditation','compliance_eligibility','compliance_potential')),
  start_on date,
  expiry_on date,
  approved_on date,
  url text,
  accreditation_id text,
  unique (project_id, label_id, kind)
);

create table cdop.project_landowner (
  project_id text not null references cdop.project(id) on delete cascade,
  name text not null,
  sort int not null default 0,
  primary key (project_id, name)
);

-- Denormalised registry history for CDOP registry.previous[] (rare re-registrations).
create table cdop.project_registry_history (
  id text primary key,
  project_id text not null references cdop.project(id) on delete cascade,
  crediting_program_id text references cdop.crediting_program(id),
  previous_registration_id text,
  rejection_on date,
  rejection_reason text
);

-- Project-level triggers bumping the parent on child change.
create trigger project_location_touch after insert or update or delete on cdop.project_location for each row execute function cdop.touch_project();
create trigger project_mitigation_touch after insert or update or delete on cdop.project_mitigation for each row execute function cdop.touch_project();
create trigger project_status_history_touch after insert or update or delete on cdop.project_status_history for each row execute function cdop.touch_project();
create trigger crediting_period_touch after insert or update or delete on cdop.crediting_period for each row execute function cdop.touch_project();
create trigger geolocation_file_touch_project after insert or update or delete on cdop.geolocation_file for each row execute function cdop.touch_project();
create trigger project_stakeholder_touch after insert or update or delete on cdop.project_stakeholder for each row execute function cdop.touch_project();
create trigger project_label_touch after insert or update or delete on cdop.project_label for each row execute function cdop.touch_project();
