import { useState, useEffect, useCallback } from 'react';
import { useAccountContext } from '@/contexts/AccountContext';

export interface AdCreative {
  ad_id: string;
  ad_name: string;
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  status: 'Winner' | 'Good' | 'Risk' | 'Bad' | 'Learning';
  score: number;
  reasons: string[];
  conversion_mode: 'purchase' | 'lead' | 'traffic' | null;
  score_link_ctr: number | null;
  score_lp_cvr: number | null;
  score_hook_rate: number | null;
  score_roas: number | null;
  score_cpl: number | null;
  score_leads_count: number | null;
  score_adset_avg_cpa: number | null;
  score_adset_avg_link_ctr: number | null;
  thumbnail_url: string | null;
  image_url: string | null;
  media_best_url: string | null;
  video_source: string | null;
  video_source_type: string | null;
  video_thumbnail_url: string | null;
  creative_type: string | null;
  preview_html: string | null;
  preview_html_format: string | null;
  is_dynamic_creative: boolean;
  ad_preview_html: string | null;
  ad_preview_format: string | null;
  impressions: number;
  clicks: number;
  link_clicks: number;
  landing_page_views: number;
  leads: number;
  video_thruplay: number;
  video_p25: number;
  reach: number;
  spend: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpa: number;
  link_ctr: number;
  lp_cvr: number;
  hook_rate: number;
  cpl: number;
  frequency: number;
}

export interface CreativeSummary {
  Winner: number; Good: number; Risk: number; Bad: number; Learning: number;
}

export interface FilterOption {
  id: string; name: string;
}

type DatePreset = 'today' | 'yesterday' | 'last_7d' | 'last_30d';

export function useCreativeIntelligence() {
  const { activeAccount } = useAccountContext();
  const [ads, setAds] = useState<AdCreative[]>([]);
  const [summary, setSummary] = useState<CreativeSummary>({ Winner: 0, Good: 0, Risk: 0, Bad: 0, Learning: 0 });
  const [campaigns, setCampaigns] = useState<FilterOption[]>([]);
  const [adsets, setAdsets] = useState<FilterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [selectedAdset, setSelectedAdset] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('last_7d');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const baseUrl = `${supabaseUrl}/functions/v1`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ date_preset: datePreset });
      if (activeAccount?.ad_account_id) params.set('account_id', activeAccount.ad_account_id);
      if (selectedCampaign) params.set('campaign_id', selectedCampaign);
      if (selectedAdset) params.set('adset_id', selectedAdset);
      if (selectedStatus) params.set('status', selectedStatus.toLowerCase());

      const res = await fetch(`${baseUrl}/creative-intelligence-feed?${params.toString()}`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      });
      const result = await res.json();

      if (result.error) { setError(result.error); return; }

      setAds(result.ads || []);
      setSummary(result.summary || { Winner: 0, Good: 0, Risk: 0, Bad: 0, Learning: 0 });
      setCampaigns(result.campaigns || []);
      setAdsets(result.adsets || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [datePreset, selectedCampaign, selectedAdset, selectedStatus, activeAccount?.ad_account_id, baseUrl, anonKey]);

  const syncData = useCallback(async (forceRefresh = false) => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`${baseUrl}/meta-sync-creative-intelligence`, {
        method: 'POST',
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: activeAccount?.ad_account_id || '',
          date_preset: datePreset === 'last_30d' ? 'last_30d' : datePreset === 'today' ? 'today' : datePreset === 'yesterday' ? 'yesterday' : 'last_7d',
          time_increment: 1,
          force_refresh: forceRefresh,
        }),
      });
      const result = await res.json();
      if (result.error) { setError(result.error); }
      else { setSyncResult(result); await fetchData(); }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }, [baseUrl, anonKey, activeAccount?.ad_account_id, datePreset, fetchData]);

  // Reset filters and reload when account changes
  useEffect(() => {
    setSelectedCampaign('');
    setSelectedAdset('');
    setSelectedStatus('');
    setSyncResult(null);
  }, [activeAccount?.ad_account_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return {
    ads, summary, campaigns, adsets, loading, error, syncing, syncResult,
    selectedCampaign, setSelectedCampaign,
    selectedAdset, setSelectedAdset,
    selectedStatus, setSelectedStatus,
    datePreset, setDatePreset,
    reload: fetchData,
    syncData,
  };
}
