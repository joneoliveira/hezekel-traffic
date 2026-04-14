-- ── Add super_admin to role constraint ───────────────────────────────────────
alter table user_roles drop constraint if exists user_roles_role_check;
alter table user_roles add constraint user_roles_role_check
  check (role in ('super_admin', 'gestor', 'gestor_trafego', 'marketing'));

-- ── clients: only super_admin writes ──────────────────────────────────────────
drop policy if exists "clients_select"       on clients;
drop policy if exists "clients_write_gestor" on clients;

create policy "clients_select" on clients for select to authenticated using (
  exists (select 1 from user_roles where user_id = auth.uid() and role = 'super_admin')
  or exists (select 1 from client_users where client_id = clients.id and user_id = auth.uid())
);
create policy "clients_write_super_admin" on clients for all to authenticated
  using  (exists (select 1 from user_roles where user_id = auth.uid() and role = 'super_admin'))
  with check (exists (select 1 from user_roles where user_id = auth.uid() and role = 'super_admin'));

-- ── client_users: only super_admin writes ─────────────────────────────────────
drop policy if exists "client_users_select"       on client_users;
drop policy if exists "client_users_write_gestor" on client_users;

create policy "client_users_select" on client_users for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from user_roles where user_id = auth.uid() and role = 'super_admin')
);
create policy "client_users_write_super_admin" on client_users for all to authenticated
  using  (exists (select 1 from user_roles where user_id = auth.uid() and role = 'super_admin'))
  with check (exists (select 1 from user_roles where user_id = auth.uid() and role = 'super_admin'));

-- ── meta_accounts: super_admin sees/writes all; gestor writes for own clients ─
drop policy if exists "meta_accounts_select"       on meta_accounts;
drop policy if exists "meta_accounts_write_gestor" on meta_accounts;

create policy "meta_accounts_select" on meta_accounts for select to authenticated using (
  exists (select 1 from user_roles where user_id = auth.uid() and role = 'super_admin')
  or (
    client_id is not null
    and exists (select 1 from client_users where client_id = meta_accounts.client_id and user_id = auth.uid())
  )
);
create policy "meta_accounts_write_super_admin" on meta_accounts for all to authenticated
  using  (exists (select 1 from user_roles where user_id = auth.uid() and role = 'super_admin'))
  with check (exists (select 1 from user_roles where user_id = auth.uid() and role = 'super_admin'));

create policy "meta_accounts_write_gestor" on meta_accounts for all to authenticated
  using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'gestor')
    and client_id is not null
    and exists (select 1 from client_users where client_id = meta_accounts.client_id and user_id = auth.uid())
  )
  with check (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'gestor')
    and client_id is not null
    and exists (select 1 from client_users where client_id = meta_accounts.client_id and user_id = auth.uid())
  );
