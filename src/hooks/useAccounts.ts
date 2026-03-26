import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MetaAccount {
  id: string;
  name: string;
  access_token: string;
  ad_account_id: string;
  is_active: boolean;
  created_at: string;
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<MetaAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('meta_accounts')
      .select('*')
      .order('created_at', { ascending: true });
    setAccounts((data as MetaAccount[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeAccount = accounts.find(a => a.is_active) ?? null;

  async function activateAccount(id: string) {
    const account = accounts.find(a => a.id === id);
    if (!account) return;

    // Mark active in meta_accounts
    await supabase.from('meta_accounts').update({ is_active: false }).neq('id', id);
    await supabase.from('meta_accounts').update({ is_active: true }).eq('id', id);

    // Sync to app_settings so all edge functions pick it up
    await supabase.from('app_settings').upsert([
      { key: 'meta_access_token', value: account.access_token },
      { key: 'meta_ad_account_id', value: account.ad_account_id },
    ], { onConflict: 'key' });

    await load();
  }

  async function addAccount(name: string, accessToken: string, adAccountId: string): Promise<MetaAccount> {
    const isFirst = accounts.length === 0;
    const { data, error } = await supabase
      .from('meta_accounts')
      .insert({ name, access_token: accessToken, ad_account_id: adAccountId, is_active: isFirst })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const account = data as MetaAccount;

    if (isFirst) {
      await supabase.from('app_settings').upsert([
        { key: 'meta_access_token', value: accessToken },
        { key: 'meta_ad_account_id', value: adAccountId },
      ], { onConflict: 'key' });
    }

    await load();
    return account;
  }

  async function updateAccountName(id: string, name: string) {
    await supabase.from('meta_accounts').update({ name }).eq('id', id);
    await load();
  }

  async function deleteAccount(id: string) {
    const wasActive = accounts.find(a => a.id === id)?.is_active;
    await supabase.from('meta_accounts').delete().eq('id', id);
    await load();

    // If deleted account was active, activate the first remaining one
    if (wasActive) {
      const remaining = accounts.filter(a => a.id !== id);
      if (remaining.length > 0) await activateAccount(remaining[0].id);
    }
  }

  return { accounts, activeAccount, loading, activateAccount, addAccount, updateAccountName, deleteAccount, reload: load };
}
