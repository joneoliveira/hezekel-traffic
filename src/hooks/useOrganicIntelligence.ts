import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useClientContext } from '@/contexts/ClientContext';

export interface OrganicPost {
  id: string;
  caption: string | null;
  media_type: string | null;
  media_product_type: string | null;
  timestamp: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  media_url: string | null;
  // insights
  reach: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saved: number;
  total_interactions: number;
  avg_watch_time_ms: number;
  total_watch_time_ms: number;
  // computed
  engagement_rate: number;
  score: number;
  status: string;
}

export interface IgAccount {
  id: string;
  name: string;
  ig_account_id: string;
}

// Scores relative to the average: <50% bad, 50-80% risk, 80-120% good, >120% winner
function scoreRelative(value: number, avg: number): number {
  if (avg === 0) return 50;
  const ratio = value / avg;
  if (ratio >= 1.2) return 100;
  if (ratio >= 0.8) return 50 + ((ratio - 0.8) / 0.4) * 50;
  if (ratio >= 0.5) return 20 + ((ratio - 0.5) / 0.3) * 30;
  return Math.max(0, (ratio / 0.5) * 20);
}

function scoreEngagement(value: number, avg: number): number {
  return scoreRelative(value, avg);
}

function computeStatus(score: number, timestamp: string | null): string {
  if (timestamp) {
    const ageMs = Date.now() - new Date(timestamp).getTime();
    if (ageMs < 24 * 60 * 60 * 1000) return 'Learning';
  }
  if (score >= 75) return 'Winner';
  if (score >= 55) return 'Good';
  if (score >= 35) return 'Risk';
  return 'Bad';
}

function daysAgoStr(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

export function useOrganicIntelligence() {
  const { activeClient } = useClientContext();
  const [igAccounts, setIgAccounts] = useState<IgAccount[]>([]);
  const [selectedIgAccountId, setSelectedIgAccountId] = useState('');
  const [posts, setPosts] = useState<OrganicPost[]>([]);
  const [followerHistory, setFollowerHistory] = useState<{ date: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [since, setSince] = useState(daysAgoStr(30));
  const [until, setUntil] = useState(new Date().toISOString().split('T')[0]);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [search, setSearch] = useState('');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  // Load IG accounts for the active client whenever it changes
  useEffect(() => {
    if (!activeClient?.id) {
      setIgAccounts([]);
      setSelectedIgAccountId('');
      return;
    }
    supabase
      .from('ig_accounts')
      .select('id, name, ig_account_id')
      .eq('client_id', activeClient.id)
      .order('name')
      .then(({ data }) => {
        const list = (data as IgAccount[]) ?? [];
        setIgAccounts(list);
        setSelectedIgAccountId(list.length > 0 ? list[0].ig_account_id : '');
      });
  }, [activeClient?.id]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('ig_organic_media')
        .select(`
          id, caption, media_type, media_product_type, timestamp, permalink, thumbnail_url, media_url,
          ig_organic_insights (
            reach, views, likes, comments, shares, saved,
            total_interactions, avg_watch_time_ms, total_watch_time_ms
          )
        `)
        .gte('timestamp', since + 'T00:00:00Z')
        .lte('timestamp', until + 'T23:59:59Z')
        .order('timestamp', { ascending: false });

      if (selectedIgAccountId) {
        query = query.eq('ig_account_id', selectedIgAccountId);
      }

      const { data, error: err } = await query;
      if (err) throw err;

      // First pass: extract raw values
      const raw = (data || []).map((row: any) => {
        const ins = row.ig_organic_insights || {};
        const reach = ins.reach ?? 0;
        const views = ins.views ?? 0;
        const likes = ins.likes ?? 0;
        const comments = ins.comments ?? 0;
        const shares = ins.shares ?? 0;
        const saved = ins.saved ?? 0;
        const avg_watch_time_ms = ins.avg_watch_time_ms ?? 0;
        const engagement_rate = reach > 0 ? ((likes + comments + shares + saved) / reach) * 100 : 0;
        return { row, reach, views, likes, comments, shares, saved, avg_watch_time_ms, engagement_rate,
          total_interactions: ins.total_interactions ?? 0, total_watch_time_ms: ins.total_watch_time_ms ?? 0 };
      });

      // Compute averages across all posts
      const n = raw.length || 1;
      const avgReach = raw.reduce((s, r) => s + r.reach, 0) / n;
      const avgViews = raw.reduce((s, r) => s + r.views, 0) / n;
      const avgEngagement = raw.reduce((s, r) => s + r.engagement_rate, 0) / n;

      // Second pass: score relative to averages
      const processed: OrganicPost[] = raw.map(({ row, reach, views, likes, comments, shares, saved,
        avg_watch_time_ms, engagement_rate, total_interactions, total_watch_time_ms }) => {

        const reachScore = scoreRelative(reach, avgReach);
        const viewsScore = scoreRelative(views, avgViews);
        const engagementScore = scoreEngagement(engagement_rate, avgEngagement);

        const score = Math.round(reachScore * 0.3 + viewsScore * 0.4 + engagementScore * 0.3);
        const status = computeStatus(score, row.timestamp);

        return {
          id: row.id,
          caption: row.caption,
          media_type: row.media_type,
          media_product_type: row.media_product_type,
          timestamp: row.timestamp,
          permalink: row.permalink,
          thumbnail_url: row.thumbnail_url,
          media_url: row.media_url,
          reach, views, likes, comments, shares, saved,
          total_interactions, avg_watch_time_ms, total_watch_time_ms,
          engagement_rate, score, status,
        };
      });

      processed.sort((a, b) => b.score - a.score);
      setPosts(processed);

      // Load follower history for the selected account
      const historyKey = selectedIgAccountId
        ? `ig_follower_history_${selectedIgAccountId}`
        : 'ig_follower_history';

      const { data: fhRow } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', historyKey)
        .single();
      try {
        setFollowerHistory(JSON.parse(fhRow?.value || '[]'));
      } catch (_) {}
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [since, until, selectedIgAccountId]);

  const syncData = useCallback(async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const body: Record<string, string> = {};
      if (selectedIgAccountId) body.ig_account_id = selectedIgAccountId;

      const res = await fetch(`${supabaseUrl}/functions/v1/ig-sync-organic`, {
        method: 'POST',
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setSyncResult(`${result.synced} posts sincronizados`);
      await fetchData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  }, [supabaseUrl, anonKey, fetchData, selectedIgAccountId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const summary = {
    Winner: posts.filter(p => p.status === 'Winner').length,
    Good: posts.filter(p => p.status === 'Good').length,
    Risk: posts.filter(p => p.status === 'Risk').length,
    Bad: posts.filter(p => p.status === 'Bad').length,
    Learning: posts.filter(p => p.status === 'Learning').length,
  };

  const filtered = posts
    .filter(p => !selectedStatus || p.status === selectedStatus)
    .filter(p => !selectedType || p.media_product_type === selectedType || p.media_type === selectedType)
    .filter(p => !search.trim() || (p.caption ?? '').toLowerCase().includes(search.trim().toLowerCase()));

  // Compute follower growth within selected period
  const followersSince = followerHistory.find(e => e.date >= since)?.count ?? null;
  const followersUntil = [...followerHistory].reverse().find(e => e.date <= until)?.count ?? null;
  const followersGrowth = followersSince != null && followersUntil != null
    ? followersUntil - followersSince : null;
  const followersNow = followersUntil;

  return {
    igAccounts, selectedIgAccountId, setSelectedIgAccountId,
    posts: filtered, summary, loading, error, syncing, syncResult,
    since, setSince, until, setUntil,
    followersNow, followersGrowth,
    selectedStatus, setSelectedStatus,
    selectedType, setSelectedType,
    search, setSearch,
    reload: fetchData, syncData,
  };
}
