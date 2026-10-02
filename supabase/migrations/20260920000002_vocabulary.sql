-- 0002: vocabularies and id authorities (registries, programs, standards, methodologies,
-- enums, native/canonical lifecycle tables, document types, labels).

create table cdop.registry (
  id text primary key,                         -- slug used as URN namespace: 'ukl', 'verra', ...
  cdop_name text not null unique,              -- exact CDOP enum string
  operator_name text,
  url text,
  project_url_template text,                   -- '{native_project_id}' placeholder
  serial_grammar text,
  country_code text,
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  version int not null default 1
);

create table cdop.crediting_program (
  id text primary key,
  cdop_name text not null unique,
  url text
);

create table cdop.standard (
  id text primary key,                         -- 'wcc','pc','vcs','gs4gg','acr','plan-vivo','puro'
  cdop_name text not null unique,              -- exact CDOP standard_name value
  short_code text not null,
  crediting_program_id text not null references cdop.crediting_program(id),
  registry_id text not null references cdop.registry(id),
  native_standard_id text,
  unit_type_pending text,
  unit_type_verified text not null,
  default_buffer_rate numeric(5,4),
  vintage_period_years int not null default 1,
  verification_schedule jsonb not null default '{}'::jsonb check (jsonb_typeof(verification_schedule) = 'object'),
  status_vocabulary text not null default 'generic'
);

create table cdop.standard_version (
  id text primary key,
  standard_id text not null references cdop.standard(id),
  version text not null,
  effective_on date,
  is_current boolean not null default false,
  unique (standard_id, version)
);

create table cdop.methodology (
  id text primary key,
  cdop_name text not null unique,              -- exact CDOP enum string, e.g. 'VCS - VM0033'
  code text,
  title text,
  standard_id text references cdop.standard(id),
  sector text,
  url text
);

create table cdop.methodology_version (
  id text primary key,
  methodology_id text not null references cdop.methodology(id),
  version text not null,
  document_url text,
  effective_on date,
  is_current boolean not null default false,
  unique (methodology_id, version)
);

-- Every enum in the vendored schema, loaded at seed time (served at /v2/reference/{list}).
create table cdop.cdop_vocabulary (
  vocabulary text not null,
  term text not null,
  sort int not null,
  cdop_field_id int,
  cdop_field_path text,
  primary key (vocabulary, term)
);

create table cdop.document_type (
  id text primary key,                         -- 'wcc:100000000000370', 'generic:pdd'
  standard_id text references cdop.standard(id),
  native_id text,
  name text not null,
  cdop_type text,                              -- one of other_project_documentation_type, or null
  kind text not null check (kind in ('pdd','map','carbon_calc','validation_report','validation_statement',
    'verification_report','verification_statement','monitoring_report','registration','legal','photos',
    'risk','baseline','plan','shapefile','other')),
  stage text check (stage in ('registration','validation','verification','issuance','any'))
);

create table cdop.label (
  id text primary key,
  name text not null,
  level text not null check (level in ('project','unit','standard')),
  issuer text,
  url text,
  cdop_enum_value text
);

-- Registry-native project states with their owner seat and the canonical state they map to.
create table cdop.native_state (
  standard_id text not null references cdop.standard(id),
  code text not null,
  name text not null,
  owner_actor text not null check (owner_actor in ('developer','code_admin','vvb','registry','none')),
  lifecycle_state text not null check (lifecycle_state in
    ('draft','listed','registered','validated','verified','retired','withdrawn','rejected')),
  cdop_project_status text not null,           -- one of CDOP's 17 project_status values
  phase text,
  is_terminal boolean not null default false,
  sort int not null default 0,
  primary key (standard_id, code)
);

create table cdop.native_transition (
  standard_id text not null,
  from_code text not null,
  action text not null,
  actor text not null check (actor in ('developer','code_admin','vvb','registry','system')),
  intent text not null check (intent in ('submit','approve','more_info','reject','hold','release','withdraw','verify','issue','other')),
  to_code text not null,
  label text not null,
  requires_reason boolean not null default false,
  primary key (standard_id, from_code, action),
  foreign key (standard_id, from_code) references cdop.native_state (standard_id, code),
  foreign key (standard_id, to_code) references cdop.native_state (standard_id, code)
);

-- Canonical unit-block machine (standard independent).
create table cdop.lifecycle_transition (
  entity text not null,
  from_state text not null,
  action text not null,
  actor text not null,
  to_state text not null,
  emits_event text not null,
  label text not null,
  primary key (entity, from_state, action)
);
