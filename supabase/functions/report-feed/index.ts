import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { config, account_id } = await req.json();

    if (!config || !config.segments || config.segments.length === 0) {
      return new Response(JSON.stringify({ error: 'Configuração inválida' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    // ── Sync fresh data before querying ───────────────────────────────────────
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const syncRes = await fetch(`${supabaseUrl}/functions/v1/meta-sync-creative-intelligence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
        },
        body: JSON.stringify({ account_id, date_preset: config.date_preset }),
      });
      await syncRes.json().catch(() => {}); // consume body to ensure sync completes
    } catch (_) { /* sync failure is non-fatal — proceed with cached data */ }

    // ── Date range ────────────────────────────────────────────────────────────
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    function daysAgo(n: number) {
      const d = new Date(today);
      d.setDate(d.getDate() - n);
      return d.toISOString().split('T')[0];
    }

    let since: string;
    let until: string;
    switch (config.date_preset) {
      case 'today':     since = todayStr;    until = todayStr;    break;
      case 'yesterday': since = yesterdayStr; until = yesterdayStr; break;
      case 'last_7d':   since = daysAgo(7);  until = todayStr;    break;
      case 'last_30d':  since = daysAgo(30); until = todayStr;    break;
      default:          since = todayStr;    until = todayStr;
    }

    // ── Process each segment ──────────────────────────────────────────────────
    const segments = [];

    for (const segment of config.segments) {
      // Step 1 — find ad_ids matching the campaign filter
      let creativesQuery = supabase
        .from('meta_ad_creatives')
        .select('ad_id')
        .range(0, 49999);

      if (segment.campaign_contains?.trim()) {
        creativesQuery = creativesQuery.ilike('campaign_name', `%${segment.campaign_contains.trim()}%`);
      }
      if (account_id) {
        creativesQuery = creativesQuery.eq('account_id', account_id);
      }

      const { data: creatives, error: cErr } = await creativesQuery;

      if (cErr) {
        segments.push({ segment, data: null, error: cErr.message });
        continue;
      }

      const adIds = (creatives ?? []).map((c: any) => c.ad_id);

      if (adIds.length === 0) {
        segments.push({ segment, data: null, error: 'Nenhum anúncio encontrado para este filtro' });
        continue;
      }

      // Step 2 — aggregate insights for those ad_ids
      const { data: rows, error: iErr } = await supabase
        .from('meta_ad_insights')
        .select('spend, impressions, clicks, reach, leads, conversions, revenue, link_clicks, landing_page_views, video_thruplay, video_3s, video_p25, video_p50, video_p75, video_p100')
        .in('ad_id', adIds)
        .gte('date_start', since)
        .lte('date_start', until)
        .range(0, 99999);

      if (iErr) {
        segments.push({ segment, data: null, error: iErr.message });
        continue;
      }

      if (!rows || rows.length === 0) {
        segments.push({ segment, data: null, error: 'Sem dados para o período selecionado' });
        continue;
      }

      // Aggregate sums
      const agg = (rows as any[]).reduce((acc, row) => {
        acc.spend              += Number(row.spend)              || 0;
        acc.impressions        += Number(row.impressions)        || 0;
        acc.clicks             += Number(row.clicks)             || 0;
        acc.reach              += Number(row.reach)              || 0;
        acc.leads              += Number(row.leads)              || 0;
        acc.conversions        += Number(row.conversions)        || 0;
        acc.revenue            += Number(row.revenue)            || 0;
        acc.link_clicks        += Number(row.link_clicks)        || 0;
        acc.landing_page_views += Number(row.landing_page_views) || 0;
        acc.video_thruplay     += Number(row.video_thruplay)     || 0;
        acc.video_3s           += Number(row.video_3s)           || 0;
        acc.video_p25          += Number(row.video_p25)          || 0;
        acc.video_p50          += Number(row.video_p50)          || 0;
        acc.video_p75          += Number(row.video_p75)          || 0;
        acc.video_p100         += Number(row.video_p100)         || 0;
        return acc;
      }, {
        spend: 0, impressions: 0, clicks: 0, reach: 0,
        leads: 0, conversions: 0, revenue: 0,
        link_clicks: 0, landing_page_views: 0,
        video_thruplay: 0, video_3s: 0,
        video_p25: 0, video_p50: 0, video_p75: 0, video_p100: 0,
      });

      // Derived metrics
      const data = {
        ...agg,
        cpm:          agg.impressions        > 0 ? (agg.spend / agg.impressions) * 1000                  : 0,
        cpc:          agg.clicks             > 0 ? agg.spend / agg.clicks                                : 0,
        ctr:          agg.impressions        > 0 ? (agg.clicks / agg.impressions) * 100                  : 0,
        link_ctr:     agg.impressions        > 0 ? (agg.link_clicks / agg.impressions) * 100             : 0,
        frequency:    agg.reach              > 0 ? agg.impressions / agg.reach                           : 0,
        cpl:          agg.leads              > 0 ? agg.spend / agg.leads                                 : 0,
        cpa:          agg.conversions        > 0 ? agg.spend / agg.conversions                          : 0,
        roas:         agg.spend              > 0 ? agg.revenue / agg.spend                               : 0,
        connect_rate: agg.link_clicks        > 0 ? (agg.landing_page_views / agg.link_clicks) * 100      : 0,
        lp_cvr:       agg.landing_page_views > 0 ? (agg.conversions / agg.landing_page_views) * 100      : 0,
        hook_rate:    agg.impressions        > 0 ? (agg.video_3s / agg.impressions) * 100                : 0,
      };

      segments.push({ segment, data, error: null });
    }

    return new Response(JSON.stringify({ segments, since, until }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
