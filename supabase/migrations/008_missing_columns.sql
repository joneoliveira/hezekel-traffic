-- ── meta_ad_insights: missing columns used by sync function ──────────────────
alter table meta_ad_insights
  add column if not exists link_clicks       bigint  default 0,
  add column if not exists link_ctr          numeric(8,4) default 0,
  add column if not exists landing_page_views bigint default 0,
  add column if not exists leads             bigint  default 0,
  add column if not exists video_thruplay    bigint  default 0;

-- ── creative_scores: missing columns used by scoring function ─────────────────
alter table creative_scores
  add column if not exists conversion_mode    text,
  add column if not exists leads_count        bigint  default 0,
  add column if not exists cpl               numeric(12,2) default 0,
  add column if not exists roas              numeric(8,4)  default 0,
  add column if not exists link_ctr          numeric(8,4)  default 0,
  add column if not exists lp_cvr            numeric(8,4)  default 0,
  add column if not exists hook_rate         numeric(8,4)  default 0,
  add column if not exists adset_avg_cpa     numeric(12,2) default 0,
  add column if not exists adset_avg_link_ctr numeric(8,4) default 0;
