import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const IG_ACCOUNT_ID = '17841462505515095';
const GRAPH_BASE = 'https://graph.facebook.com/v19.0';

async function fetchJson(url: string) {
  const res = await fetch(url);
  return res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Get access token from app_settings
    const { data: tokenRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'meta_access_token')
      .single();

    const accessToken = tokenRow?.value;
    if (!accessToken) throw new Error('Access token não configurado');

    // Fetch media list (last 50 posts)
    const mediaRes = await fetchJson(
      `${GRAPH_BASE}/${IG_ACCOUNT_ID}/media?fields=id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url&limit=50&access_token=${accessToken}`
    );

    if (mediaRes.error) throw new Error(mediaRes.error.message);

    const mediaList = mediaRes.data || [];
    let synced = 0;
    let errors = 0;

    for (const media of mediaList) {
      try {
        // Upsert media
        await supabase.from('ig_organic_media').upsert({
          id: media.id,
          ig_account_id: IG_ACCOUNT_ID,
          caption: media.caption || null,
          media_type: media.media_type || null,
          media_product_type: media.media_product_type || null,
          timestamp: media.timestamp || null,
          permalink: media.permalink || null,
          thumbnail_url: media.thumbnail_url || null,
          media_url: media.media_url || null,
          synced_at: new Date().toISOString(),
        }, { onConflict: 'id' });

        // Fetch insights
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

    // Fetch account-level follower data
    const accountRes = await fetchJson(
      `${GRAPH_BASE}/${IG_ACCOUNT_ID}?fields=followers_count,media_count&access_token=${accessToken}`
    );
    const followersCount = accountRes.followers_count ?? null;

    // Save follower snapshot to app_settings as a JSON history array
    if (followersCount !== null) {
      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'ig_follower_history')
        .single();

      let history: { date: string; count: number }[] = [];
      try { history = JSON.parse(existing?.value || '[]'); } catch (_) {}

      // Upsert today's entry
      const idx = history.findIndex(e => e.date === today);
      if (idx >= 0) history[idx].count = followersCount;
      else history.push({ date: today, count: followersCount });

      // Keep last 90 days only
      history.sort((a, b) => a.date.localeCompare(b.date));
      if (history.length > 90) history = history.slice(-90);

      await supabase.from('app_settings').upsert(
        { key: 'ig_follower_history', value: JSON.stringify(history) },
        { onConflict: 'key' }
      );
    }

    return new Response(JSON.stringify({
      ok: true,
      synced,
      errors,
      total: mediaList.length,
      followers: followersCount,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
