-- 0001: schema, extensions, shared helper functions.
-- The API is the only database client: no RLS, no auth.jwt(), nothing Supabase-specific.
create schema if not exists cdop;
create extension if not exists btree_gist;

-- Bumps modified_at/version on every UPDATE of a mutable table.
create or replace function cdop.touch_modified() returns trigger language plpgsql as $$
begin
  new.modified_at := now();
  new.version := coalesce(old.version, 0) + 1;
  return new;
end $$;

-- Child changes bump the parent project's modified_at so `modified_since` on /projects
-- behaves like a registry's modifiedDate. Disabled during bulk seed via a session GUC.
create or replace function cdop.touch_project() returns trigger language plpgsql as $$
declare pid text;
begin
  if current_setting('cdop.touch_project', true) = 'off' then
    return coalesce(new, old);
  end if;
  pid := coalesce(
    case when tg_op = 'DELETE' then old.project_id else new.project_id end,
    case when tg_op = 'DELETE' then old.project_id else null end);
  if pid is not null then
    update cdop.project set modified_at = now(), version = version + 1 where id = pid;
  end if;
  return coalesce(new, old);
end $$;

