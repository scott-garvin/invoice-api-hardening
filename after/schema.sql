-- Runs as the superuser (postgres). Superusers BYPASS row-level security, so this
-- script can create cross-org seed data. The app connects as app_user (below),
-- which is a plain role RLS actually applies to.

create extension if not exists pgcrypto;

create table if not exists organizations (
  id   uuid primary key default gen_random_uuid(),
  name text not null
);

create table if not exists users (
  id     uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  email  text not null unique,
  role   text not null check (role in ('admin', 'member', 'viewer'))
);

create table if not exists clients (
  id     uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name   text not null
);

create table if not exists invoices (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  client_id    uuid not null references clients(id) on delete cascade,
  amount_cents bigint not null check (amount_cents >= 0),   -- money as integer cents, never float
  status       text not null default 'draft' check (status in ('draft', 'sent', 'paid')),
  created_at   timestamptz not null default now()
);

-- Tenant isolation enforced by the DATABASE, not just app code.
alter table clients  enable row level security;
alter table invoices enable row level security;
alter table clients  force row level security;
alter table invoices force row level security;

drop policy if exists clients_tenant_isolation on clients;
create policy clients_tenant_isolation on clients
  using      (org_id = current_setting('app.org_id', true)::uuid)
  with check (org_id = current_setting('app.org_id', true)::uuid);

drop policy if exists invoices_tenant_isolation on invoices;
create policy invoices_tenant_isolation on invoices
  using      (org_id = current_setting('app.org_id', true)::uuid)
  with check (org_id = current_setting('app.org_id', true)::uuid);
-- NOTE: current_setting(..., true) returns NULL when app.org_id is unset, so a
-- request that forgets to set the tenant context matches no rows. Fails closed.

-- Application role: not a superuser, not the table owner, so RLS binds it.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user login password 'app_pw';
  end if;
end $$;

grant usage on schema public to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
