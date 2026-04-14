-- Create avatars bucket (public read)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Users can upload/replace their own avatar (stored as {user_id})
create policy "avatar_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and name = auth.uid()::text);

create policy "avatar_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text);

create policy "avatar_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text);

-- Anyone can read avatars (public bucket)
create policy "avatar_read" on storage.objects
  for select to public
  using (bucket_id = 'avatars');
