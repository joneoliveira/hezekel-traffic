alter table meta_ad_creatives add column if not exists ad_status text;
alter table meta_ad_creatives add column if not exists adset_status text;
alter table meta_ad_creatives add column if not exists campaign_status text;
create index if not exists meta_ad_creatives_ad_status_idx on meta_ad_creatives (ad_status);
