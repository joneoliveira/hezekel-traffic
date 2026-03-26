-- Instagram organic media posts
create table if not exists ig_organic_media (
  id text primary key,
  ig_account_id text not null,
  caption text,
  media_type text,
  media_product_type text,
  timestamp timestamptz,
  permalink text,
  thumbnail_url text,
  media_url text,
  synced_at timestamptz default now()
);

-- Instagram organic insights (one row per media, upserted on sync)
create table if not exists ig_organic_insights (
  media_id text primary key references ig_organic_media(id) on delete cascade,
  reach bigint default 0,
  views bigint default 0,
  likes bigint default 0,
  comments bigint default 0,
  shares bigint default 0,
  saved bigint default 0,
  total_interactions bigint default 0,
  avg_watch_time_ms bigint default 0,
  total_watch_time_ms bigint default 0,
  synced_at timestamptz default now()
);

-- Enable RLS (read-only for authenticated)
alter table ig_organic_media enable row level security;
alter table ig_organic_insights enable row level security;

create policy "authenticated read ig_organic_media"
  on ig_organic_media for select to authenticated using (true);

create policy "authenticated read ig_organic_insights"
  on ig_organic_insights for select to authenticated using (true);

create policy "service role all ig_organic_media"
  on ig_organic_media for all to service_role using (true);

create policy "service role all ig_organic_insights"
  on ig_organic_insights for all to service_role using (true);
