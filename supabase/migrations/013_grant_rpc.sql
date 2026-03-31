-- Grant execute on RPC to authenticated users
-- The function itself checks for super_admin role internally
grant execute on function get_all_users_with_roles() to authenticated;
