-- Add destination_url column to meta_ad_creatives
-- This column stores the landing page URL extracted from object_story_spec
alter table meta_ad_creatives add column if not exists destination_url text;
create index if not exists meta_ad_creatives_destination_url_idx on meta_ad_creatives (destination_url);
