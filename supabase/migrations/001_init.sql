-- Tabela de configurações da aplicação
create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

-- Tabela de criativos sincronizados do Meta
create table if not exists meta_ad_creatives (
  ad_id text not null,
  adset_id text not null,
  campaign_id text not null,
  ad_name text,
  adset_name text,
  campaign_name text,
  creative_type text,
  image_url text,
  thumbnail_url text,
  media_best_url text,
  video_source text,
  video_source_type text,
  video_thumbnail_url text,
  preview_html text,
  preview_html_format text,
  is_dynamic_creative boolean default false,
  ad_preview_html text,
  ad_preview_format text,
  updated_at timestamptz default now(),
  primary key (ad_id)
);

-- Tabela de insights diários
create table if not exists meta_ad_insights (
  ad_id text not null,
  adset_id text not null,
  campaign_id text not null,
  date_start date not null,
  impressions bigint default 0,
  clicks bigint default 0,
  reach bigint default 0,
  spend numeric(12,2) default 0,
  conversions bigint default 0,
  revenue numeric(12,2) default 0,
  ctr numeric(8,4) default 0,
  cpc numeric(8,2) default 0,
  cpm numeric(8,2) default 0,
  frequency numeric(6,2) default 0,
  primary key (ad_id, date_start)
);

-- Score diário dos criativos
create table if not exists creative_scores (
  ad_id text not null,
  adset_id text not null,
  date date not null,
  score integer default 0,
  status text default 'Learning',
  reasons jsonb default '[]',
  primary key (ad_id, date)
);

-- Índices
create index if not exists idx_insights_adset on meta_ad_insights(adset_id, date_start);
create index if not exists idx_scores_adset on creative_scores(adset_id, date);
