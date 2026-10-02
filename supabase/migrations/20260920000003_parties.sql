-- 0003: organisations and registry accounts.

create table cdop.organisation (
  id text primary key,
  legal_name text not null,
  trading_name text,
  website text,
  email text,
  phone text,
  classification text,
  cdop_role text,                              -- organization_role enum value
  country_code text not null,
  country_name text,
  region_code text,
  region_name text,
  subdivision_code text,
  subdivision_name text,
  city text,
  postal_code text,
  address_line_1 text,
  founded_on date,
  employees int,
  project_employees int,
  mission text,
  team_experience text,
  project_experience_years int,
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  version int not null default 1
);

-- The registry-account concept CDOP lacks: who holds projects and units on a registry.
create table cdop.account (
  id text primary key,
  registry_id text not null references cdop.registry(id),
  organisation_id text references cdop.organisation(id),
  native_account_id text,
  name text not null,
  account_type text not null check (account_type in ('project_developer','project_proponent','vvb',
    'code_administrator','registry_operator','corporate_end_user','retail_aggregator','trader','buffer_pool','system')),
  status text not null default 'active' check (status in ('pending','active','suspended','closed')),
  parent_account_id text references cdop.account(id),
  is_master boolean not null default true,
  standard_id text references cdop.standard(id),
  opened_on date,
  country_code text,
  holdings_public boolean not null default false,
  retirements_public boolean not null default true,
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  version int not null default 1,
  unique (registry_id, native_account_id)
);
create index account_org_idx on cdop.account (organisation_id);
create index account_type_idx on cdop.account (registry_id, account_type);

create trigger organisation_touch before update on cdop.organisation for each row execute function cdop.touch_modified();
create trigger account_touch before update on cdop.account for each row execute function cdop.touch_modified();
