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
    const url = new URL(req.url);
    const account_id = url.searchParams.get('account_id') || '';
    const campaign_contains = url.searchParams.get('campaign_contains') || '';

    // Support explicit since/until or fall back to date_preset
    let startDate: string;
    let endDate: string;
    const since = url.searchParams.get('since');
    const until = url.searchParams.get('until');
    if (since && until) {
      startDate = since;
      endDate = until;
    } else {
      const date_preset = url.searchParams.get('date_preset') || 'last_30d';
      const today = new Date();
      endDate = today.toISOString().split('T')[0];
      if (date_preset === 'last_7d') { const d = new Date(today); d.setDate(d.getDate() - 7); startDate = d.toISOString().split('T')[0]; }
      else if (date_preset === 'last_14d') { const d = new Date(today); d.setDate(d.getDate() - 14); startDate = d.toISOString().split('T')[0]; }
      else if (date_preset === 'this_month') { startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`; }
      else { const d = new Date(today); d.setDate(d.getDate() - 30); startDate = d.toISOString().split('T')[0]; }
    }

    let insightsQuery = supabase
      .from('meta_ad_insights')
      .select('ad_id, adset_id, campaign_id, date_start, spend, impressions, clicks, conversions, revenue, ctr, cpm, frequency')
      .gte('date_start', startDate)
      .lte('date_start', endDate)
      .order('date_start', { ascending: true });
    if (account_id) insightsQuery = insightsQuery.eq('account_id', account_id);

    const { data: insights, error } = await insightsQuery;
    if (error) throw error;

    let creativesQuery = supabase
      .from('meta_ad_creatives')
      .select('ad_id, ad_name, adset_id, adset_name, campaign_id, campaign_name');
    if (account_id) creativesQuery = creativesQuery.eq('account_id', account_id);
    const { data: creatives } = await creativesQuery;

    const creativeMap = new Map((creatives || []).map((c: any) => [c.ad_id, c]));

    // Filter by campaign name if requested
    const allInsights = insights || [];
    const filteredInsights = campaign_contains
      ? allInsights.filter((r: any) => {
          const name: string = creativeMap.get(r.ad_id)?.campaign_name || '';
          return name.toLowerCase().includes(campaign_contains.toLowerCase());
        })
      : allInsights;

    if (!filteredInsights.length) {
      return new Response(JSON.stringify({ totals: { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, cpa: 0, ctr: 0, cpm: 0, roas: 0 }, daily: [], by_campaign: [], by_adset: [], by_ad: [], funnel: { impressions: 0, clicks: 0, conversions: 0, ctr: 0, click_to_conversion: 0 } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const agg = (rows: any[]) => rows.reduce((acc, r) => ({
      spend: acc.spend + parseFloat(r.spend || 0),
      impressions: acc.impressions + parseInt(r.impressions || 0),
      clicks: acc.clicks + parseInt(r.clicks || 0),
      conversions: acc.conversions + parseInt(r.conversions || 0),
      revenue: acc.revenue + parseFloat(r.revenue || 0),
    }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 });

    const withRatios = (r: any) => ({
      ...r,
      cpa: r.conversions > 0 ? r.spend / r.conversions : 0,
      ctr: r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0,
      cpm: r.impressions > 0 ? (r.spend / r.impressions) * 1000 : 0,
      roas: r.spend > 0 ? r.revenue / r.spend : 0,
    });

    const totals = withRatios(agg(filteredInsights));

    // Daily
    const dailyMap = new Map<string, any[]>();
    for (const r of filteredInsights) {
      if (!dailyMap.has(r.date_start)) dailyMap.set(r.date_start, []);
      dailyMap.get(r.date_start)!.push(r);
    }
    const daily = Array.from(dailyMap.entries())
      .map(([date, rows]) => ({ date, ...withRatios(agg(rows)) }));

    // By Campaign
    const campaignMap = new Map<string, any[]>();
    for (const r of filteredInsights) {
      const c = creativeMap.get(r.ad_id);
      const key = c?.campaign_id || r.campaign_id || 'unknown';
      if (!campaignMap.has(key)) campaignMap.set(key, []);
      campaignMap.get(key)!.push({ ...r, _name: c?.campaign_name || 'Desconhecida' });
    }
    const by_campaign = Array.from(campaignMap.entries())
      .map(([id, rows]) => ({ id, name: rows[0]._name, ...withRatios(agg(rows)) }))
      .sort((a, b) => b.spend - a.spend);

    // By Adset
    const adsetMap = new Map<string, any[]>();
    for (const r of filteredInsights) {
      const c = creativeMap.get(r.ad_id);
      const key = c?.adset_id || r.adset_id || 'unknown';
      if (!adsetMap.has(key)) adsetMap.set(key, []);
      adsetMap.get(key)!.push({ ...r, _name: c?.adset_name || 'Desconhecido' });
    }
    const by_adset = Array.from(adsetMap.entries())
      .map(([id, rows]) => ({ id, name: rows[0]._name, ...withRatios(agg(rows)) }))
      .sort((a, b) => b.spend - a.spend);

    // By Ad
    const adMap2 = new Map<string, any[]>();
    for (const r of filteredInsights) {
      if (!adMap2.has(r.ad_id)) adMap2.set(r.ad_id, []);
      adMap2.get(r.ad_id)!.push({ ...r, _name: creativeMap.get(r.ad_id)?.ad_name || r.ad_id });
    }
    const by_ad = Array.from(adMap2.entries())
      .map(([id, rows]) => ({ id, name: rows[0]._name, ...withRatios(agg(rows)) }))
      .sort((a, b) => b.spend - a.spend);

    const funnel = {
      impressions: totals.impressions,
      clicks: totals.clicks,
      conversions: totals.conversions,
      ctr: totals.ctr,
      click_to_conversion: totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0,
    };

    return new Response(JSON.stringify({ totals, daily, by_campaign, by_adset, by_ad, funnel, start_date: startDate }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
