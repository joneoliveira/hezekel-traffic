import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function weekLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=Sun
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const mon = new Date(d); mon.setDate(d.getDate() + diffToMon);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = (dt: Date) => `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;
  return `${fmt(mon)} a ${fmt(sun)}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const url = new URL(req.url);
    const account_id = url.searchParams.get('account_id') || '';
    const since = url.searchParams.get('since') || '';
    const until = url.searchParams.get('until') || '';
    const campaign_contains = url.searchParams.get('campaign_contains') || '';

    if (!account_id) {
      return new Response(JSON.stringify({ rows: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Default: last 30 days
    const endDate = until || new Date().toISOString().split('T')[0];
    const startDate = since || (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; })();

    // Fetch insights
    let q = supabase
      .from('meta_ad_insights')
      .select('ad_id, date_start, spend, impressions, reach, cpm, ctr, cpc, video_3s, video_p25, video_p50, video_p75, video_p100, video_thruplay')
      .gte('date_start', startDate)
      .lte('date_start', endDate);
    if (account_id) q = q.eq('account_id', account_id);
    const { data: insights, error } = await q;
    if (error) throw error;

    // Fetch creatives for campaign name + video link
    let cq = supabase
      .from('meta_ad_creatives')
      .select('ad_id, campaign_name, video_source, ad_name');
    if (account_id) cq = cq.eq('account_id', account_id);
    const { data: creatives } = await cq;

    const creativeMap = new Map((creatives || []).map((c: any) => [c.ad_id, c]));

    // Filter by campaign name
    const filtered = (insights || []).filter((r: any) => {
      if (!campaign_contains) return true;
      const name: string = creativeMap.get(r.ad_id)?.campaign_name || '';
      return name.toLowerCase().includes(campaign_contains.toLowerCase());
    });

    // Group by week + ad
    const weekAdMap = new Map<string, Map<string, any>>();

    for (const r of filtered) {
      const week = weekLabel(r.date_start);
      const c = creativeMap.get(r.ad_id);
      const adKey = r.ad_id;

      if (!weekAdMap.has(week)) weekAdMap.set(week, new Map());
      const adMap = weekAdMap.get(week)!;

      if (!adMap.has(adKey)) {
        adMap.set(adKey, {
          ad_id: r.ad_id,
          ad_name: c?.ad_name || r.ad_id,
          campaign_name: c?.campaign_name || '',
          video_source: c?.video_source || null,
          spend: 0, impressions: 0, reach: 0,
          video_3s: 0, video_p25: 0, video_p50: 0, video_p75: 0, video_p100: 0, video_thruplay: 0,
          clicks: 0,
        });
      }

      const agg = adMap.get(adKey)!;
      agg.spend += parseFloat(r.spend || 0);
      agg.impressions += parseInt(r.impressions || 0);
      agg.reach += parseInt(r.reach || 0);
      agg.video_3s += parseInt(r.video_3s || 0);
      agg.video_p25 += parseInt(r.video_p25 || 0);
      agg.video_p50 += parseInt(r.video_p50 || 0);
      agg.video_p75 += parseInt(r.video_p75 || 0);
      agg.video_p100 += parseInt(r.video_p100 || 0);
      agg.video_thruplay += parseInt(r.video_thruplay || 0);
    }

    // Sort weeks chronologically
    const weekOrder = [...weekAdMap.keys()].sort((a, b) => {
      const getDay = (w: string) => parseInt(w.split('/')[0]);
      const getMonth = (w: string) => parseInt(w.split('/')[1]);
      const aDate = new Date(2026, getMonth(a) - 1, getDay(a));
      const bDate = new Date(2026, getMonth(b) - 1, getDay(b));
      return aDate.getTime() - bDate.getTime();
    });

    const rows = weekOrder.map(week => {
      const ads = [...weekAdMap.get(week)!.values()].map(ad => {
        const cpm = ad.impressions > 0 ? (ad.spend / ad.impressions) * 1000 : 0;
        const ctr = ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0;
        const cpc = ad.clicks > 0 ? ad.spend / ad.clicks : 0;
        const cost_per_view_50 = ad.video_p50 > 0 ? ad.spend / ad.video_p50 : 0;
        return { ...ad, cpm, ctr, cpc, cost_per_view_50 };
      });
      return { week, ads };
    });

    return new Response(JSON.stringify({ rows }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
