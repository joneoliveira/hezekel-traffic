-- Tighten RLS on ig_organic_media: only show posts from accounts the user has access to
drop policy if exists "authenticated read ig_organic_media" on ig_organic_media;
drop policy if exists "authenticated read ig_organic_insights" on ig_organic_insights;

create policy "ig_organic_media_select" on ig_organic_media for select to authenticated using (
  exists (
    select 1 from ig_accounts
    where ig_accounts.ig_account_id = ig_organic_media.ig_account_id
    and (
      exists (select 1 from user_roles where user_id = auth.uid() and role = 'super_admin')
      or (
        ig_accounts.client_id is not null
        and exists (select 1 from client_users where client_id = ig_accounts.client_id and user_id = auth.uid())
      )
    )
  )
);

create policy "ig_organic_insights_select" on ig_organic_insights for select to authenticated using (
  exists (
    select 1 from ig_organic_media
    join ig_accounts on ig_accounts.ig_account_id = ig_organic_media.ig_account_id
    where ig_organic_media.id = ig_organic_insights.media_id
    and (
      exists (select 1 from user_roles where user_id = auth.uid() and role = 'super_admin')
      or (
        ig_accounts.client_id is not null
        and exists (select 1 from client_users where client_id = ig_accounts.client_id and user_id = auth.uid())
      )
    )
  )
);
