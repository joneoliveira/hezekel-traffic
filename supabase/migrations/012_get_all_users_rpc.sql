-- RPC: get_all_users_with_roles
-- Returns all auth users with their role — accessible only to super_admin
create or replace function get_all_users_with_roles()
returns table (
  id        uuid,
  email     text,
  role      text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only super_admin can call this
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'super_admin'
  ) then
    raise exception 'Forbidden';
  end if;

  return query
    select
      au.id,
      au.email::text,
      coalesce(ur.role, 'none') as role,
      au.created_at
    from auth.users au
    left join user_roles ur on ur.user_id = au.id
    order by au.created_at desc;
end;
$$;
