-- The MVP's schema, as generated: no row-level security, money stored as a float.
create extension if not exists pgcrypto;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  email text not null unique,
  role text not null default 'member'
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  name text not null
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  client_id uuid not null references clients(id),
  amount double precision not null default 0,   -- money as a float
  status text not null default 'draft',
  created_at timestamptz not null default now()
);
