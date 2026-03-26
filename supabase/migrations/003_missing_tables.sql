-- user_roles table
create table if not exists user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('gestor', 'gestor_trafego', 'marketing')),
  created_at timestamptz default now()
);
alter table user_roles enable row level security;
create policy "authenticated read user_roles"
  on user_roles for select to authenticated using (true);
create policy "service role all user_roles"
  on user_roles for all to service_role using (true);

-- meta_accounts table
create table if not exists meta_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  access_token text,
  ad_account_id text not null,
  is_active boolean default false,
  created_at timestamptz default now()
);
alter table meta_accounts enable row level security;
create policy "authenticated read meta_accounts"
  on meta_accounts for select to authenticated using (true);
create policy "service role all meta_accounts"
  on meta_accounts for all to service_role using (true);
