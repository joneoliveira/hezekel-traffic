import { useState, useEffect, useCallback } from 'react';
import { useAccountContext } from '@/contexts/AccountContext';

export interface ContentIntelligenceAd {
  ad_id: string;
  ad_name: string;
  campaign_name: string;
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
  cost_per_view_50: number;
  hook_rate: number;
  retention_50: number;
  completion_rate: number;
  score: number;
  status: string;
}

export type ContentStatus = 'Winner' | 'Good' | 'Risk' | 'Bad' | 'Learning';

export interface ContentSummary {
  Winner: number;
  Good: number;
  Risk: number;
  Bad: number;
  Learning: number;
}

const CI_FILTER_KEY = 'content_intel_campaign_filter';

function daysAgoStr(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function scoreMetric(value: number, bad: number, risk: number, good: number): number {
  if (value >= good) return 100;
  if (value >= risk) return 50 + ((value - risk) / (good - risk)) * 50;
  if (value >= bad) return 20 + ((value - bad) / (risk - bad)) * 30;
  return Math.max(0, (value / bad) * 20);
}

function computeStatus(score: number, spend: number): string {
  if (spend < 50) return 'Learning';
  if (score >= 75) return 'Winner';
  if (score >= 55) return 'Good';
  if (score >= 35) return 'Risk';
  return 'Bad';
}

export function useContentIntelligence() {
  const { activeAccount } = useAccountContext();
  const [ads, setAds] = useState<ContentIntelligenceAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [since, setSince] = useState(daysAgoStr(30));
  const [until, setUntil] = useState(new Date().toISOString().split('T')[0]);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [search, setSearch] = useState('');
  const [campaignFilter, setCampaignFilterState] = useState<string>(
    () => localStorage.getItem(CI_FILTER_KEY) ?? ''
  );

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const saveCampaignFilter = useCallback((val: string) => {
    localStorage.setItem(CI_FILTER_KEY, val);
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

      // Flatten weekly rows into per-ad totals
      const adMap = new Map<string, any>();
      for (const week of (result.rows || [])) {
        for (const ad of week.ads) {
          if (!adMap.has(ad.ad_id)) {
            adMap.set(ad.ad_id, {
              ad_id: ad.ad_id,
              ad_name: ad.ad_name,
              campaign_name: ad.campaign_name || '',
              video_source: ad.video_source,
              spend: 0, impressions: 0, reach: 0,
              video_3s: 0, video_p25: 0, video_p50: 0,
              video_p75: 0, video_p100: 0, video_thruplay: 0,
            });
          }
          const agg = adMap.get(ad.ad_id)!;
          agg.spend += ad.spend;
          agg.impressions += ad.impressions;
          agg.reach += ad.reach;
          agg.video_3s += ad.video_3s;
          agg.video_p25 += ad.video_p25;
          agg.video_p50 += ad.video_p50;
          agg.video_p75 += ad.video_p75;
          agg.video_p100 += ad.video_p100;
          agg.video_thruplay += ad.video_thruplay;
        }
      }

      const processed: ContentIntelligenceAd[] = [...adMap.values()].map(ad => {
        const hook_rate = ad.impressions > 0 ? (ad.video_3s / ad.impressions) * 100 : 0;
        const retention_50 = ad.video_3s > 0 ? (ad.video_p50 / ad.video_3s) * 100 : 0;
        const completion_rate = ad.video_3s > 0 ? (ad.video_p100 / ad.video_3s) * 100 : 0;
        const cpm = ad.impressions > 0 ? (ad.spend / ad.impressions) * 1000 : 0;
        const cost_per_view_50 = ad.video_p50 > 0 ? ad.spend / ad.video_p50 : 0;

        const hookScore = scoreMetric(hook_rate, 8, 15, 25);
        const retentionScore = scoreMetric(retention_50, 20, 35, 50);
        const completionScore = scoreMetric(completion_rate, 8, 15, 30);
        const score = Math.round(hookScore * 0.3 + retentionScore * 0.4 + completionScore * 0.3);
        const status = computeStatus(score, ad.spend);

        return { ...ad, hook_rate, retention_50, completion_rate, cpm, cost_per_view_50, score, status };
      });

      processed.sort((a, b) => b.score - a.score);
      setAds(processed);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [since, until, campaignFilter, activeAccount?.ad_account_id, supabaseUrl, anonKey]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const summary: ContentSummary = {
    Winner: ads.filter(a => a.status === 'Winner').length,
    Good: ads.filter(a => a.status === 'Good').length,
    Risk: ads.filter(a => a.status === 'Risk').length,
    Bad: ads.filter(a => a.status === 'Bad').length,
    Learning: ads.filter(a => a.status === 'Learning').length,
  };

  const filtered = ads
    .filter(a => !selectedStatus || a.status === selectedStatus)
    .filter(a => !search.trim() || a.ad_name.toLowerCase().includes(search.trim().toLowerCase()));

  return {
    ads: filtered, summary, loading, error,
    since, setSince, until, setUntil,
    selectedStatus, setSelectedStatus,
    search, setSearch,
    campaignFilter, saveCampaignFilter,
    reload: fetchData,
  };
}
