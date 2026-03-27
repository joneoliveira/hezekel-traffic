-- Allow authenticated users to read app_settings
-- and super_admin / gestor to write
alter table app_settings enable row level security;

create policy "app_settings_select" on app_settings
  for select to authenticated using (true);

create policy "app_settings_write" on app_settings
  for all to authenticated
  using (
    exists (select 1 from user_roles where user_id = auth.uid() and role in ('super_admin', 'gestor'))
  )
  with check (
    exists (select 1 from user_roles where user_id = auth.uid() and role in ('super_admin', 'gestor'))
  );

create policy "app_settings_service" on app_settings
  for all to service_role using (true);
