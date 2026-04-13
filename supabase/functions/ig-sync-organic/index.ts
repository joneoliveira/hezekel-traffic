import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH_BASE = 'https://graph.facebook.com/v19.0';

async function fetchJson(url: string) {
  const res = await fetch(url);
  return res.json();
}

async function fetchAllMedia(igAccountId: string, accessToken: string): Promise<any[]> {
  const all: any[] = [];
  let url: string | null =
    `${GRAPH_BASE}/${igAccountId}/media?fields=id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url&limit=50&access_token=${accessToken}`;

  while (url && all.length < 500) {
    const res = await fetchJson(url);
    if (res.error) throw new Error(res.error.message);
    all.push(...(res.data || []));
    url = res.paging?.next ?? null;
  }

  return all;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const requestedIgAccountId: string | undefined = body.ig_account_id;

    let igAccountId: string;
    let accessToken: string;

    if (requestedIgAccountId) {
      // Multi-account: read from ig_accounts table
      const { data: account, error } = await supabase
        .from('ig_accounts')
        .select('ig_account_id, access_token')
        .eq('ig_account_id', requestedIgAccountId)
        .single();

      if (error || !account) throw new Error('Conta Instagram não encontrada na tabela ig_accounts');
      if (!account.access_token) throw new Error('Token de acesso não configurado para esta conta');

      igAccountId = account.ig_account_id;
      accessToken = account.access_token;
    } else {
      // Backward compat: use app_settings token + first active ig_account
      const { data: tokenRow } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'meta_access_token')
        .single();

      accessToken = tokenRow?.value;
      if (!accessToken) throw new Error('Nenhuma conta Instagram fornecida e token padrão não configurado');

      const { data: firstAccount } = await supabase
        .from('ig_accounts')
        .select('ig_account_id')
        .eq('is_active', true)
        .order('created_at')
        .limit(1)
        .single();

      if (!firstAccount) throw new Error('Nenhuma conta Instagram cadastrada. Adicione uma no painel Admin.');
      igAccountId = firstAccount.ig_account_id;
    }

    // Fetch all media with pagination (up to 500 posts)
    const mediaList = await fetchAllMedia(igAccountId, accessToken);
    let synced = 0;
    let errors = 0;

    for (const media of mediaList) {
      try {
        await supabase.from('ig_organic_media').upsert({
          id: media.id,
          ig_account_id: igAccountId,
          caption: media.caption || null,
          media_type: media.media_type || null,
          media_product_type: media.media_product_type || null,
          timestamp: media.timestamp || null,
          permalink: media.permalink || null,
          thumbnail_url: media.thumbnail_url || null,
          media_url: media.media_url || null,
          synced_at: new Date().toISOString(),
        }, { onConflict: 'id' });

        const insightsRes = await fetchJson(
          `${GRAPH_BASE}/${media.id}/insights?metric=reach,views,likes,comments,shares,saved,total_interactions,ig_reels_avg_watch_time,ig_reels_video_view_total_time&period=lifetime&access_token=${accessToken}`
        );

        if (!insightsRes.error && insightsRes.data) {
          const getValue = (name: string) =>
            insightsRes.data.find((d: any) => d.name === name)?.values?.[0]?.value ?? 0;

          await supabase.from('ig_organic_insights').upsert({
            media_id: media.id,
            reach: getValue('reach'),
            views: getValue('views'),
            likes: getValue('likes'),
            comments: getValue('comments'),
            shares: getValue('shares'),
            saved: getValue('saved'),
            total_interactions: getValue('total_interactions'),
            avg_watch_time_ms: getValue('ig_reels_avg_watch_time'),
            total_watch_time_ms: getValue('ig_reels_video_view_total_time'),
            synced_at: new Date().toISOString(),
          }, { onConflict: 'media_id' });
        }

        synced++;
      } catch (_) {
        errors++;
      }
    }

    // Fetch and store follower snapshot (per account)
    const accountRes = await fetchJson(
      `${GRAPH_BASE}/${igAccountId}?fields=followers_count,media_count&access_token=${accessToken}`
    );
    const followersCount = accountRes.followers_count ?? null;

    if (followersCount !== null) {
      const today = new Date().toISOString().split('T')[0];
      const historyKey = `ig_follower_history_${igAccountId}`;

      const { data: existing } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', historyKey)
        .single();

      let history: { date: string; count: number }[] = [];
      try { history = JSON.parse(existing?.value || '[]'); } catch (_) {}

      const idx = history.findIndex(e => e.date === today);
      if (idx >= 0) history[idx].count = followersCount;
      else history.push({ date: today, count: followersCount });

      history.sort((a, b) => a.date.localeCompare(b.date));
      if (history.length > 90) history = history.slice(-90);

      await supabase.from('app_settings').upsert(
        { key: historyKey, value: JSON.stringify(history) },
        { onConflict: 'key' }
      );
    }

    return new Response(JSON.stringify({
      ok: true,
      synced,
      errors,
      total: mediaList.length,
      followers: followersCount,
      ig_account_id: igAccountId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
