import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const url = new URL(req.url);
    const date_preset = url.searchParams.get('date_preset') || 'last_7d';
    const campaign_id = url.searchParams.get('campaign_id') || '';
    const adset_id = url.searchParams.get('adset_id') || '';
    const status_filter = url.searchParams.get('status') || '';

    // Calcular range de datas
    const today = new Date();
    let startDate: string;
    if (date_preset === 'today') startDate = today.toISOString().split('T')[0];
    else if (date_preset === 'yesterday') { const d = new Date(today); d.setDate(d.getDate() - 1); startDate = d.toISOString().split('T')[0]; }
    else if (date_preset === 'last_30d') { const d = new Date(today); d.setDate(d.getDate() - 30); startDate = d.toISOString().split('T')[0]; }
    else { const d = new Date(today); d.setDate(d.getDate() - 7); startDate = d.toISOString().split('T')[0]; }

    const account_id = url.searchParams.get('account_id') || '';

    // Buscar insights agregados (apenas da conta ativa)
    let insightsQuery = supabase
      .from('meta_ad_insights')
      .select('*')
      .gte('date_start', startDate);
    if (account_id) insightsQuery = insightsQuery.eq('account_id', account_id);
    const { data: insights } = await insightsQuery;

    if (!insights || insights.length === 0) {
      return new Response(JSON.stringify({ ads: [], summary: { Winner: 0, Good: 0, Risk: 0, Bad: 0, Learning: 0 }, campaigns: [], adsets: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Agregar por ad
    const adMap = new Map<string, any>();
    for (const row of insights) {
      if (!adMap.has(row.ad_id)) {
        adMap.set(row.ad_id, { ad_id: row.ad_id, adset_id: row.adset_id, campaign_id: row.campaign_id, spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, frequency: 0, link_clicks: 0, landing_page_views: 0, leads: 0, video_thruplay: 0, video_p25: 0, rows: 0 });
      }
      const a = adMap.get(row.ad_id)!;
      a.spend += parseFloat(row.spend || 0);
      a.impressions += parseInt(row.impressions || 0);
      a.clicks += parseInt(row.clicks || 0);
      a.conversions += parseInt(row.conversions || 0);
      a.revenue += parseFloat(row.revenue || 0);
      a.frequency = parseFloat(row.frequency || 0); // última
      a.reach = parseInt(row.reach || 0);
      a.link_clicks += parseInt(row.link_clicks || 0);
      a.landing_page_views += parseInt(row.landing_page_views || 0);
      a.leads += parseInt(row.leads || 0);
      a.video_thruplay += parseInt(row.video_thruplay || 0);
      a.video_p25 += parseInt(row.video_p25 || 0);
      a.rows++;
    }

    // Buscar criativos (da conta ativa)
    const adIdsArr = Array.from(adMap.keys());
    let creativesQuery = supabase.from('meta_ad_creatives').select('*').in('ad_id', adIdsArr);
    if (account_id) creativesQuery = creativesQuery.eq('account_id', account_id);
    const { data: creatives } = await creativesQuery;
    const creativeMap = new Map((creatives || []).map((c: any) => [c.ad_id, c]));

    // Buscar scores mais recentes
    const { data: scores } = await supabase
      .from('creative_scores')
      .select('*')
      .in('ad_id', adIdsArr)
      .order('date', { ascending: false });

    const scoreMap = new Map<string, any>();
    for (const s of (scores || [])) {
      if (!scoreMap.has(s.ad_id)) scoreMap.set(s.ad_id, s);
    }

    // Montar resultado
    let ads: any[] = [];
    const campaignSet = new Map<string, string>();
    const adsetSet = new Map<string, string>();

    for (const [adId, agg] of adMap) {
      const creative = creativeMap.get(adId) || {};
      const score = scoreMap.get(adId);

      if (campaign_id && agg.campaign_id !== campaign_id) continue;
      if (adset_id && agg.adset_id !== adset_id) continue;

      const ctr = agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0;
      const cpc = agg.clicks > 0 ? agg.spend / agg.clicks : 0;
      const cpm = agg.impressions > 0 ? (agg.spend / agg.impressions) * 1000 : 0;
      const cpa = agg.conversions > 0 ? agg.spend / agg.conversions : 0;

      const link_ctr = agg.impressions > 0 ? (agg.link_clicks / agg.impressions) * 100 : 0;
      const lp_cvr = agg.link_clicks > 0 ? (agg.landing_page_views / agg.link_clicks) * 100 : 0;
      const hook_rate = agg.impressions > 0 ? (agg.video_thruplay / agg.impressions) * 100 : 0;
      const cpl = agg.leads > 0 ? agg.spend / agg.leads : 0;

      const adObj = {
        ad_id: adId,
        ad_name: creative.ad_name || adId,
        ad_status: creative.ad_status || null,
        campaign_id: agg.campaign_id,
        campaign_name: creative.campaign_name || '',
        adset_id: agg.adset_id,
        adset_name: creative.adset_name || '',
        status: score?.status || 'Learning',
        score: score?.score || 0,
        reasons: score?.reasons || [],
        conversion_mode: score?.conversion_mode || null,
        // Score detail fields
        score_link_ctr: score?.link_ctr ?? null,
        score_lp_cvr: score?.lp_cvr ?? null,
        score_hook_rate: score?.hook_rate ?? null,
        score_roas: score?.roas ?? null,
        score_cpl: score?.cpl ?? null,
        score_leads_count: score?.leads_count ?? null,
        score_adset_avg_cpa: score?.adset_avg_cpa ?? null,
        score_adset_avg_link_ctr: score?.adset_avg_link_ctr ?? null,
        // Creative
        thumbnail_url: creative.thumbnail_url || null,
        image_url: creative.image_url || null,
        media_best_url: creative.media_best_url || null,
        video_source: creative.video_source || null,
        video_source_type: creative.video_source_type || null,
        video_thumbnail_url: creative.video_thumbnail_url || null,
        creative_type: creative.creative_type || null,
        preview_html: creative.preview_html || null,
        ad_preview_html: creative.ad_preview_html || null,
        is_dynamic_creative: creative.is_dynamic_creative || false,
        // Metrics
        impressions: agg.impressions,
        clicks: agg.clicks,
        link_clicks: agg.link_clicks,
        landing_page_views: agg.landing_page_views,
        leads: agg.leads,
        video_thruplay: agg.video_thruplay,
        video_p25: agg.video_p25,
        reach: agg.reach || 0,
        spend: agg.spend,
        conversions: agg.conversions,
        revenue: agg.revenue,
        ctr, cpc, cpm, cpa, link_ctr, lp_cvr, hook_rate, cpl,
        frequency: agg.frequency,
      };

      if (status_filter && adObj.status.toLowerCase() !== status_filter.toLowerCase()) continue;

      ads.push(adObj);

      if (creative.campaign_id && creative.campaign_name) campaignSet.set(creative.campaign_id, creative.campaign_name);
      if (creative.adset_id && creative.adset_name) adsetSet.set(creative.adset_id, creative.adset_name);
    }

    // Ordenar por score desc
    ads.sort((a, b) => b.score - a.score);

    const summary = { Winner: 0, Good: 0, Risk: 0, Bad: 0, Learning: 0 };
    for (const ad of ads) { if (ad.status in summary) (summary as any)[ad.status]++; }

    const campaigns = Array.from(campaignSet.entries()).map(([id, name]) => ({ id, name }));
    const adsets = Array.from(adsetSet.entries()).map(([id, name]) => ({ id, name }));

    return new Response(JSON.stringify({ ads, summary, campaigns, adsets }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
