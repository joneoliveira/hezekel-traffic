import { useState, useEffect, useCallback } from 'react';
import { useAccountContext } from '@/contexts/AccountContext';

export type DatePreset = 'last_7d' | 'last_14d' | 'last_30d' | 'this_month' | 'custom';

export interface DashboardData {
  totals: {
    spend: number; impressions: number; clicks: number;
    conversions: number; revenue: number; cpa: number;
    ctr: number; cpm: number; roas: number;
  };
  daily: { date: string; spend: number; clicks: number; conversions: number; cpa: number; ctr: number }[];
  by_campaign: { id: string; name: string; spend: number; conversions: number; cpa: number; ctr: number; revenue: number }[];
  by_adset: { id: string; name: string; spend: number; conversions: number; cpa: number; ctr: number; revenue: number }[];
  by_ad: { id: string; name: string; spend: number; conversions: number; cpa: number; ctr: number; revenue: number }[];
  funnel: { impressions: number; clicks: number; conversions: number; ctr: number; click_to_conversion: number };
  start_date: string;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

export function useDashboard() {
  const { activeAccount } = useAccountContext();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>('last_30d');
  const [since, setSince] = useState(daysAgoStr(30));
  const [until, setUntil] = useState(todayStr());
  const [campaignFilter, setCampaignFilter] = useState('DCM');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  // Sync since/until when preset changes
  useEffect(() => {
    if (datePreset === 'custom') return;
    const today = new Date();
    if (datePreset === 'last_7d') { setSince(daysAgoStr(7)); setUntil(todayStr()); }
    else if (datePreset === 'last_14d') { setSince(daysAgoStr(14)); setUntil(todayStr()); }
    else if (datePreset === 'last_30d') { setSince(daysAgoStr(30)); setUntil(todayStr()); }
    else if (datePreset === 'this_month') {
      setSince(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`);
      setUntil(todayStr());
    }
  }, [datePreset]);

  const fetchData = useCallback(async () => {
    if (!since || !until) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ since, until });
      if (activeAccount?.ad_account_id) params.set('account_id', activeAccount.ad_account_id);
      if (campaignFilter.trim()) params.set('campaign_contains', campaignFilter.trim());

      const res = await fetch(`${supabaseUrl}/functions/v1/dashboard-feed?${params.toString()}`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setData(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [since, until, campaignFilter, activeAccount?.ad_account_id, supabaseUrl, anonKey]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return {
    data, loading, error,
    datePreset, setDatePreset,
    since, setSince,
    until, setUntil,
    campaignFilter, setCampaignFilter,
    reload: fetchData,
  };
}
