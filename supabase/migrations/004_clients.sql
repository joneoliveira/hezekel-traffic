-- ── Create tables first (policies reference each other) ──────────────────────

create table if not exists clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz default now()
);

create table if not exists client_users (
  client_id  uuid not null references clients(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (client_id, user_id)
);

-- ── clients RLS ───────────────────────────────────────────────────────────────

alter table clients enable row level security;

create policy "clients_select" on clients for select to authenticated using (
  exists (select 1 from user_roles where user_id = auth.uid() and role = 'gestor')
  or exists (select 1 from client_users where client_id = clients.id and user_id = auth.uid())
);
create policy "clients_write_gestor" on clients for all to authenticated
  using  (exists (select 1 from user_roles where user_id = auth.uid() and role = 'gestor'))
  with check (exists (select 1 from user_roles where user_id = auth.uid() and role = 'gestor'));
create policy "clients_service" on clients for all to service_role using (true);

-- ── client_users RLS ──────────────────────────────────────────────────────────

alter table client_users enable row level security;

create policy "client_users_select" on client_users for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from user_roles where user_id = auth.uid() and role = 'gestor')
);
create policy "client_users_write_gestor" on client_users for all to authenticated
  using  (exists (select 1 from user_roles where user_id = auth.uid() and role = 'gestor'))
  with check (exists (select 1 from user_roles where user_id = auth.uid() and role = 'gestor'));
create policy "client_users_service" on client_users for all to service_role using (true);

-- ── meta_accounts: add client_id + update RLS ─────────────────────────────────

alter table meta_accounts add column if not exists client_id uuid references clients(id) on delete set null;

drop policy if exists "authenticated read meta_accounts" on meta_accounts;

create policy "meta_accounts_select" on meta_accounts for select to authenticated using (
  exists (select 1 from user_roles where user_id = auth.uid() and role = 'gestor')
  or (
    client_id is not null
    and exists (
      select 1 from client_users
      where client_id = meta_accounts.client_id and user_id = auth.uid()
    )
  )
);
create policy "meta_accounts_write_gestor" on meta_accounts for all to authenticated
  using  (exists (select 1 from user_roles where user_id = auth.uid() and role = 'gestor'))
  with check (exists (select 1 from user_roles where user_id = auth.uid() and role = 'gestor'));
