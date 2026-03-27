-- Add account_id column to tables used by meta-sync-creative-intelligence
alter table meta_ad_insights   add column if not exists account_id text;
alter table meta_ad_creatives  add column if not exists account_id text;
alter table creative_scores    add column if not exists account_id text;

-- Index for filtering by account
create index if not exists meta_ad_insights_account_id_idx  on meta_ad_insights  (account_id);
create index if not exists meta_ad_creatives_account_id_idx on meta_ad_creatives (account_id);
create index if not exists creative_scores_account_id_idx   on creative_scores   (account_id);
