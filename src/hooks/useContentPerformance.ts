import { useState, useEffect, useCallback } from 'react';
import { useAccountContext } from '@/contexts/AccountContext';

export interface ContentAdRow {
  ad_id: string;
  ad_name: string;
  video_source: string | null;
  spend: number;
  impressions: number;
  reach: number;
  video_3s: number;
  video_p25: number;
  video_p50: number;
  video_p75: number;
  video_p100: number;
  video_thruplay: number;
  cpm: number;
  ctr: number;
  cpc: number;
  cost_per_view_50: number;
}

export interface ContentWeekRow {
  week: string;
  ads: ContentAdRow[];
}

const CP_FILTER_KEY = 'content_perf_campaign_filter';

function daysAgoStr(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

export function useContentPerformance() {
  const { activeAccount } = useAccountContext();
  const [rows, setRows] = useState<ContentWeekRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [since, setSince] = useState(daysAgoStr(30));
  const [until, setUntil] = useState(new Date().toISOString().split('T')[0]);
  const [campaignFilter, setCampaignFilterState] = useState<string>(
    () => localStorage.getItem(CP_FILTER_KEY) ?? ''
  );

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const saveCampaignFilter = useCallback((val: string) => {
    localStorage.setItem(CP_FILTER_KEY, val);
    setCampaignFilterState(val);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ since, until });
      if (activeAccount?.ad_account_id) params.set('account_id', activeAccount.ad_account_id);
      if (campaignFilter.trim()) params.set('campaign_contains', campaignFilter.trim());

      const res = await fetch(`${supabaseUrl}/functions/v1/content-performance-feed?${params}`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setRows(result.rows || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [since, until, campaignFilter, activeAccount?.ad_account_id, supabaseUrl, anonKey]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { rows, loading, error, since, setSince, until, setUntil, campaignFilter, saveCampaignFilter, reload: fetchData };
}
