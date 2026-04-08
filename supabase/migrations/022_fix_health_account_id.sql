-- Fix typo in Health account ID: act_2699013358281290 → act_2690013358281290
UPDATE meta_accounts
SET ad_account_id = 'act_2690013358281290'
WHERE ad_account_id = 'act_2699013358281290';

-- Also fix in app_settings if it was cached there
UPDATE app_settings
SET value = 'act_2690013358281290'
WHERE key = 'meta_ad_account_id' AND value = 'act_2699013358281290';
