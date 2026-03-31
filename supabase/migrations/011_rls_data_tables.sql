-- ── Enable RLS on ad data tables ─────────────────────────────────────────────
-- Previously these tables had no RLS — any authenticated user could read all data

ALTER TABLE meta_ad_creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_ad_insights  ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_scores   ENABLE ROW LEVEL SECURITY;

-- Edge functions use service_role key and bypass RLS (sync, feed, duplicate)
CREATE POLICY "creatives_service" ON meta_ad_creatives FOR ALL TO service_role USING (true);
CREATE POLICY "insights_service"  ON meta_ad_insights  FOR ALL TO service_role USING (true);
CREATE POLICY "scores_service"    ON creative_scores   FOR ALL TO service_role USING (true);

-- super_admin sees all; others see only data from accounts assigned to their clients
CREATE POLICY "creatives_select" ON meta_ad_creatives FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  OR (
    account_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM meta_accounts ma
      JOIN client_users cu ON cu.client_id = ma.client_id
      WHERE ma.ad_account_id = meta_ad_creatives.account_id
        AND cu.user_id = auth.uid()
    )
  )
);

CREATE POLICY "insights_select" ON meta_ad_insights FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  OR (
    account_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM meta_accounts ma
      JOIN client_users cu ON cu.client_id = ma.client_id
      WHERE ma.ad_account_id = meta_ad_insights.account_id
        AND cu.user_id = auth.uid()
    )
  )
);

CREATE POLICY "scores_select" ON creative_scores FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  OR (
    account_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM meta_accounts ma
      JOIN client_users cu ON cu.client_id = ma.client_id
      WHERE ma.ad_account_id = creative_scores.account_id
        AND cu.user_id = auth.uid()
    )
  )
);

-- ── Restrict app_settings: only super_admin and gestor can read ───────────────
-- Previously all authenticated users could read (exposing the global Meta token)
DROP POLICY IF EXISTS "app_settings_read" ON app_settings;

CREATE POLICY "app_settings_read" ON app_settings FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role IN ('super_admin', 'gestor')
  )
);
