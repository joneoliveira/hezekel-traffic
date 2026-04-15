-- ── 023: social_media role + fix user_roles RLS ──────────────────────────────

-- 1. Adiciona social_media ao constraint de role
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('super_admin', 'gestor', 'gestor_trafego', 'marketing', 'social_media'));

-- 2. Helper security definer para evitar recursão infinita na policy de user_roles
--    (a policy de user_roles não pode referenciar user_roles diretamente sem isso)
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin'
  );
$$;

-- 3. Restringe user_roles: usuário vê só o próprio registro; super_admin vê todos
--    (antes era "using (true)" — qualquer usuário via todos os emails e roles)
DROP POLICY IF EXISTS "authenticated read user_roles" ON user_roles;
CREATE POLICY "user_roles_select" ON user_roles FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR is_super_admin()
);
