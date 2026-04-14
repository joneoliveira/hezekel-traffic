-- ── meta_ad_insights: video performance columns ───────────────────────────────
alter table meta_ad_insights
  add column if not exists video_p25   bigint default 0,
  add column if not exists video_p50   bigint default 0,
  add column if not exists video_p75   bigint default 0,
  add column if not exists video_p100  bigint default 0,
  add column if not exists video_3s    bigint default 0;
