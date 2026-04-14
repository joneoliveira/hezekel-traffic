-- Tabela de templates de relatórios
create table if not exists report_templates (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid references clients(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name       text not null,
  config     jsonb not null default '{"date_preset":"today","segments":[]}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table report_templates enable row level security;

-- Super admin acessa tudo
create policy "report_templates_super_admin"
  on report_templates for all to authenticated
  using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'super_admin')
  )
  with check (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'super_admin')
  );

-- Usuários acessam templates do próprio cliente
create policy "report_templates_client_access"
  on report_templates for all to authenticated
  using (
    client_id in (
      select client_id from client_users where user_id = auth.uid()
    )
  )
  with check (
    client_id in (
      select client_id from client_users where user_id = auth.uid()
    )
  );
