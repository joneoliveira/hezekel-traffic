-- Instagram accounts table (multiple accounts per client)
create table if not exists ig_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ig_account_id text not null unique,
  access_token text,
  client_id uuid references clients(id) on delete set null,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table ig_accounts enable row level security;

-- super_admin sees and writes all
create policy "ig_accounts_select" on ig_accounts for select to authenticated using (
  exists (select 1 from user_roles where user_id = auth.uid() and role = 'super_admin')
  or (
    client_id is not null
    and exists (select 1 from client_users where client_id = ig_accounts.client_id and user_id = auth.uid())
  )
);

create policy "ig_accounts_write_super_admin" on ig_accounts for all to authenticated
  using  (exists (select 1 from user_roles where user_id = auth.uid() and role = 'super_admin'))
  with check (exists (select 1 from user_roles where user_id = auth.uid() and role = 'super_admin'));

create policy "ig_accounts_service" on ig_accounts for all to service_role using (true);
