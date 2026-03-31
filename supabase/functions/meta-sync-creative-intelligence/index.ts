import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE = 'https://graph.facebook.com/v25.0';

function extractDestinationUrl(spec: any, assetFeed: any): string | null {
  // Standard link ads
  if (spec.link_data?.call_to_action?.value?.link) return spec.link_data.call_to_action.value.link;
  if (spec.link_data?.link) return spec.link_data.link;

  // Carousel ads — URL lives in the first child attachment
  const firstChild = spec.link_data?.child_attachments?.[0];
  if (firstChild?.call_to_action?.value?.link) return firstChild.call_to_action.value.link;
  if (firstChild?.link) return firstChild.link;

  // Video ads
  if (spec.video_data?.call_to_action?.value?.link) return spec.video_data.call_to_action.value.link;
  if (spec.video_data?.link) return spec.video_data.link;

  // Dynamic / template ads (catalog, collection)
  if (spec.template_data?.call_to_action?.value?.link) return spec.template_data.call_to_action.value.link;
  if (spec.template_data?.link) return spec.template_data.link;

  // Advantage+ / asset feed
  if (assetFeed?.link_urls?.[0]?.website_url) return assetFeed.link_urls[0].website_url;

  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const { date_preset = 'last_7d', account_id: bodyAccountId } = body;

    // ── Credentials ──────────────────────────────────────────────────────────
    let accessToken: string | undefined;
    let adAccountId: string | undefined;

    if (bodyAccountId) {
      const { data } = await supabase.from('meta_accounts').select('access_token, ad_account_id').eq('ad_account_id', bodyAccountId).single();
      accessToken = data?.access_token;
      adAccountId = data?.ad_account_id;
    }
    if (!accessToken || !adAccountId) {
      const { data: settings } = await supabase.from('app_settings').select('key, value').in('key', ['meta_access_token', 'meta_ad_account_id']);
      accessToken = settings?.find((r: any) => r.key === 'meta_access_token')?.value;
      adAccountId = settings?.find((r: any) => r.key === 'meta_ad_account_id')?.value;
    }
    if (!accessToken || !adAccountId) {
      return new Response(JSON.stringify({ error: 'Credenciais do Meta não configuradas.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    const accountTag = adAccountId;
    const accountId = adAccountId.replace('act_', '');

    // ── Fetch insights ────────────────────────────────────────────────────────
    const insightFields = [
      'ad_id', 'ad_name', 'adset_id', 'adset_name', 'campaign_id', 'campaign_name',
      'impressions', 'clicks', 'reach', 'spend', 'ctr', 'cpc', 'cpm', 'frequency',
      'inline_link_clicks', 'inline_link_click_ctr',
      'actions', 'action_values',
      'video_thruplay_watched_actions', 'video_p25_watched_actions',
      'video_p50_watched_actions', 'video_p75_watched_actions', 'video_p100_watched_actions',
    ].join(',');

    // Paginate through all insight rows (Meta returns max 500 per page)
    const insights: any[] = [];
    let nextUrl: string | null = `${BASE}/act_${accountId}/insights?fields=${insightFields}&date_preset=${date_preset}&time_increment=1&level=ad&limit=500&access_token=${accessToken}`;

    while (nextUrl) {
      const pageData = await fetch(nextUrl).then(r => r.json());
      if (pageData.error) throw new Error(pageData.error.message);
      insights.push(...(pageData.data || []));
      nextUrl = pageData.paging?.next ?? null;
    }
    const adIds = new Set<string>();
    const adInfoMap = new Map<string, any>();

    // ── Build insight rows ────────────────────────────────────────────────────
    const insightRows = insights.map((row: any) => {
      const findAction = (type: string) => parseFloat(row.actions?.find((a: any) => a.action_type === type)?.value || '0');
      const findActionValue = (type: string) => parseFloat(row.action_values?.find((a: any) => a.action_type === type)?.value || '0');

      const purchases = findAction('purchase');
      const revenue = findActionValue('purchase');
      const leads = findAction('lead') || findAction('complete_registration');
      const landingPageViews = findAction('landing_page_view');
      const videoThruplay = parseFloat(row.video_thruplay_watched_actions?.[0]?.value || '0');
      const videoP25 = parseFloat(row.video_p25_watched_actions?.[0]?.value || '0');
      const videoP50 = parseFloat(row.video_p50_watched_actions?.[0]?.value || '0');
      const videoP75 = parseFloat(row.video_p75_watched_actions?.[0]?.value || '0');
      const videoP100 = parseFloat(row.video_p100_watched_actions?.[0]?.value || '0');
      const video3s = findAction('video_view');
      const linkClicks = parseInt(row.inline_link_clicks || '0');
      const linkCtr = parseFloat(row.inline_link_click_ctr || '0');

      adIds.add(row.ad_id);
      adInfoMap.set(row.ad_id, {
        adset_id: row.adset_id, campaign_id: row.campaign_id,
        ad_name: row.ad_name, adset_name: row.adset_name, campaign_name: row.campaign_name,
      });

      return {
        account_id: accountTag,
        ad_id: row.ad_id, adset_id: row.adset_id, campaign_id: row.campaign_id,
        date_start: row.date_start,
        impressions: parseInt(row.impressions || '0'),
        clicks: parseInt(row.clicks || '0'),
        link_clicks: linkClicks,
        link_ctr: linkCtr,
        reach: parseInt(row.reach || '0'),
        spend: parseFloat(row.spend || '0'),
        conversions: Math.round(purchases),
        revenue,
        leads: Math.round(leads),
        landing_page_views: Math.round(landingPageViews),
        video_thruplay: Math.round(videoThruplay),
        video_p25: Math.round(videoP25),
        video_p50: Math.round(videoP50),
        video_p75: Math.round(videoP75),
        video_p100: Math.round(videoP100),
        video_3s: Math.round(video3s),
        ctr: parseFloat(row.ctr || '0'),
        cpc: parseFloat(row.cpc || '0'),
        cpm: parseFloat(row.cpm || '0'),
        frequency: parseFloat(row.frequency || '0'),
      };
    });

    let synced_insights_rows = 0;
    if (insightRows.length > 0) {
      const { error } = await supabase.from('meta_ad_insights').upsert(insightRows, { onConflict: 'ad_id,date_start' });
      if (error) throw new Error('Erro ao salvar insights: ' + error.message);
      synced_insights_rows = insightRows.length;
    }

    // ── Fetch campaign + adset statuses (Batch API) ──────────────────────────
    const adIdsArr = Array.from(adIds);
    let creatives_upserted = 0;
    let videos_resolved = 0;

    const uniqueAdsetIds = Array.from(new Set(Array.from(adInfoMap.values()).map((v: any) => v.adset_id).filter(Boolean)));
    const uniqueCampaignIds = Array.from(new Set(Array.from(adInfoMap.values()).map((v: any) => v.campaign_id).filter(Boolean)));

    const adsetStatusMap = new Map<string, string>();
    const campaignStatusMap = new Map<string, string>();

    // Batch fetch adset statuses
    for (let i = 0; i < uniqueAdsetIds.length; i += 50) {
      const batch = uniqueAdsetIds.slice(i, i + 50).map((id: string) => ({
        method: 'GET', relative_url: `${id}?fields=effective_status`,
      }));
      const res = await fetch(`${BASE}?access_token=${accessToken}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch }),
      });
      const data = await res.json();
      for (let j = 0; j < batch.length; j++) {
        const item = data[j];
        if (!item || item.code !== 200) continue;
        const parsed = JSON.parse(item.body);
        adsetStatusMap.set(uniqueAdsetIds[i + j], parsed.effective_status || null);
      }
    }

    // Batch fetch campaign statuses
    for (let i = 0; i < uniqueCampaignIds.length; i += 50) {
      const batch = uniqueCampaignIds.slice(i, i + 50).map((id: string) => ({
        method: 'GET', relative_url: `${id}?fields=effective_status`,
      }));
      const res = await fetch(`${BASE}?access_token=${accessToken}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch }),
      });
      const data = await res.json();
      for (let j = 0; j < batch.length; j++) {
        const item = data[j];
        if (!item || item.code !== 200) continue;
        const parsed = JSON.parse(item.body);
        campaignStatusMap.set(uniqueCampaignIds[i + j], parsed.effective_status || null);
      }
    }

    // Process in batches of 50
    for (let batchStart = 0; batchStart < adIdsArr.length; batchStart += 50) {
      const batch = adIdsArr.slice(batchStart, batchStart + 50);

      // ── FIRST batch: ad details + creative ID (no spec — expanded spec is unreliable) ──
      const batchRequests = batch.map((adId: string) => ({
        method: 'GET',
        relative_url: `${adId}?fields=name,effective_status,adset_id,campaign_id,creative{id,image_url,thumbnail_url,video_id}`,
      }));

      const batchRes = await fetch(`${BASE}?access_token=${accessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch: batchRequests }),
      });
      const batchData = await batchRes.json();

      // Collect ad data and map creative ID → ad ID
      const adDataMap = new Map<string, { adData: any; creative: any; info: any }>();
      const creativeIdToAdId = new Map<string, string>();
      const videoIds: { adId: string; videoId: string }[] = [];

      for (let i = 0; i < batch.length; i++) {
        const adId = batch[i];
        const item = batchData[i];
        if (!item || item.code !== 200) continue;

        const adData = JSON.parse(item.body);
        const creative = adData.creative || {};
        const info = adInfoMap.get(adId) || {};

        if (creative.video_id) videoIds.push({ adId, videoId: creative.video_id });
        if (creative.id) creativeIdToAdId.set(creative.id, adId);

        adDataMap.set(adId, { adData, creative, info });
      }

      // ── SECOND batch: fetch object_story_spec directly by creative ID ──
      // Querying creatives directly is the reliable way — expanding from ad object
      // can return truncated or null object_story_spec for some ad types.
      const creativeIds = Array.from(creativeIdToAdId.keys());
      const specByCreativeId = new Map<string, { spec: any; assetFeed: any }>();

      if (creativeIds.length > 0) {
        const specBatch = creativeIds.map((cId: string) => ({
          method: 'GET',
          relative_url: `${cId}?fields=object_story_spec,asset_feed_spec`,
        }));
        const specRes = await fetch(`${BASE}?access_token=${accessToken}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batch: specBatch }),
        });
        const specData = await specRes.json();
        for (let j = 0; j < creativeIds.length; j++) {
          const item = specData[j];
          if (!item || item.code !== 200) continue;
          const parsed = JSON.parse(item.body);
          specByCreativeId.set(creativeIds[j], {
            spec: parsed.object_story_spec || {},
            assetFeed: parsed.asset_feed_spec || {},
          });
        }
      }

      // ── Build creative rows ────────────────────────────────────────────────
      const creativeRows: any[] = [];

      for (const [adId, { adData, creative, info }] of adDataMap) {
        const creativeSpec = creative.id ? specByCreativeId.get(creative.id) : undefined;
        const spec = creativeSpec?.spec || {};
        const assetFeed = creativeSpec?.assetFeed || {};
        const destinationUrl = extractDestinationUrl(spec, assetFeed);

        creativeRows.push({
          account_id: accountTag,
          ad_id: adId,
          ad_name: adData.name || info.ad_name || adId,
          adset_id: adData.adset_id || info.adset_id || '',
          campaign_id: adData.campaign_id || info.campaign_id || '',
          adset_name: info.adset_name || '',
          campaign_name: info.campaign_name || '',
          ad_status: adData.effective_status || null,
          adset_status: adsetStatusMap.get(adData.adset_id || info.adset_id || '') || null,
          campaign_status: campaignStatusMap.get(adData.campaign_id || info.campaign_id || '') || null,
          destination_url: destinationUrl,
          creative_type: creative.video_id ? 'video' : (creative.image_url ? 'image' : 'unknown'),
          image_url: creative.image_url || null,
          thumbnail_url: creative.thumbnail_url || null,
          updated_at: new Date().toISOString(),
        });
      }

      // Fetch video details
      if (videoIds.length > 0) {
        const videoBatch = videoIds.map(({ videoId }) => ({
          method: 'GET', relative_url: `${videoId}?fields=source,thumbnails`,
        }));
        const videoRes = await fetch(`${BASE}?access_token=${accessToken}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batch: videoBatch }),
        });
        const videoData = await videoRes.json();

        for (let i = 0; i < videoIds.length; i++) {
          const { adId } = videoIds[i];
          const item = videoData[i];
          if (!item || item.code !== 200) continue;
          const vid = JSON.parse(item.body);
          const row = creativeRows.find(r => r.ad_id === adId);
          if (row) {
            row.video_source = vid.source || null;
            row.video_thumbnail_url = vid.thumbnails?.data?.[0]?.uri || null;
            videos_resolved++;
          }
        }
      }

      if (creativeRows.length > 0) {
        const { error } = await supabase.from('meta_ad_creatives').upsert(creativeRows, { onConflict: 'ad_id' });
        if (error) throw new Error('Erro ao salvar criativos: ' + error.message);
        creatives_upserted += creativeRows.length;
      }
    }

    // ── Calculate scores ──────────────────────────────────────────────────────
    await calculateScores(supabase, adIdsArr, accountTag);

    return new Response(JSON.stringify({
      synced_insights_rows,
      unique_ads: adIds.size,
      creatives_upserted,
      videos_resolved,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});

// ─── Scoring Engine ───────────────────────────────────────────────────────────

function scoreRelative(adVal: number, adsetAvg: number, higherIsBetter: boolean): number {
  if (adsetAvg === 0 || adVal === 0) return 50;
  const diff = higherIsBetter ? (adVal - adsetAvg) : (adsetAvg - adVal);
  return 50 + Math.max(-50, Math.min(50, (diff / adsetAvg) * 100));
}

function frequencyScore(freq: number): number {
  if (freq <= 1.5) return 100;
  if (freq <= 2.0) return 90;
  if (freq <= 2.5) return 80;
  if (freq <= 3.0) return 65;
  if (freq <= 3.5) return 45;
  if (freq <= 4.0) return 25;
  return 5;
}

function avg(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

function fmt(n: number, decimals = 2): string {
  return `R$${n.toFixed(decimals)}`;
}

function pct(n: number, decimals = 1): string {
  return `${(n * 100).toFixed(decimals)}%`;
}

async function calculateScores(supabase: any, adIds: string[], accountTag: string) {
  const today = new Date().toISOString().split('T')[0];
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().split('T')[0];

  const { data: allInsights } = await supabase
    .from('meta_ad_insights')
    .select('ad_id, adset_id, spend, impressions, link_clicks, link_ctr, landing_page_views, leads, conversions, revenue, frequency, video_thruplay, cpc')
    .in('ad_id', adIds)
    .gte('date_start', sinceStr);

  if (!allInsights || allInsights.length === 0) return;

  // ── Aggregate per ad ──────────────────────────────────────────────────────
  const byAd = new Map<string, any>();
  for (const row of allInsights) {
    if (!byAd.has(row.ad_id)) {
      byAd.set(row.ad_id, {
        adset_id: row.adset_id,
        spend: 0, impressions: 0, link_clicks: 0,
        landing_page_views: 0, leads: 0, conversions: 0,
        revenue: 0, frequency: 0, video_thruplay: 0, cpc_sum: 0, cpc_rows: 0,
      });
    }
    const a = byAd.get(row.ad_id)!;
    a.spend += parseFloat(row.spend || 0);
    a.impressions += parseInt(row.impressions || 0);
    a.link_clicks += parseInt(row.link_clicks || 0);
    a.landing_page_views += parseInt(row.landing_page_views || 0);
    a.leads += parseInt(row.leads || 0);
    a.conversions += parseInt(row.conversions || 0);
    a.revenue += parseFloat(row.revenue || 0);
    a.frequency = parseFloat(row.frequency || 0); // use most recent
    a.video_thruplay += parseInt(row.video_thruplay || 0);
    if (row.cpc > 0) { a.cpc_sum += parseFloat(row.cpc); a.cpc_rows++; }
  }

  // ── Derive metrics per ad ─────────────────────────────────────────────────
  const adMetrics = new Map<string, any>();
  for (const [adId, agg] of byAd) {
    const link_ctr = agg.impressions > 0 ? (agg.link_clicks / agg.impressions) * 100 : 0;
    const lp_cvr = agg.link_clicks > 0 ? agg.landing_page_views / agg.link_clicks : 0;
    const cpc = agg.link_clicks > 0 ? agg.spend / agg.link_clicks : (agg.cpc_rows > 0 ? agg.cpc_sum / agg.cpc_rows : 0);
    const hook_rate = agg.impressions > 0 ? agg.video_thruplay / agg.impressions : 0;

    let conversion_mode = 'traffic';
    let conversions_count = 0;
    let cpa = 0;

    if (agg.conversions > 0) {
      conversion_mode = 'purchase';
      conversions_count = agg.conversions;
      cpa = agg.spend / agg.conversions;
    } else if (agg.leads > 0) {
      conversion_mode = 'lead';
      conversions_count = agg.leads;
      cpa = agg.spend / agg.leads;
    }

    adMetrics.set(adId, {
      adset_id: agg.adset_id,
      spend: agg.spend,
      impressions: agg.impressions,
      link_clicks: agg.link_clicks,
      link_ctr,
      lp_cvr,
      cpc,
      frequency: agg.frequency,
      hook_rate,
      conversion_mode,
      conversions_count,
      cpa,
      cpl: conversion_mode === 'lead' ? cpa : 0,
      roas: agg.spend > 0 ? agg.revenue / agg.spend : 0,
      leads: agg.leads,
    });
  }

  // ── Calculate adset averages ──────────────────────────────────────────────
  const adsetGroups = new Map<string, string[]>();
  for (const [adId, m] of adMetrics) {
    if (!adsetGroups.has(m.adset_id)) adsetGroups.set(m.adset_id, []);
    adsetGroups.get(m.adset_id)!.push(adId);
  }

  const adsetAvgs = new Map<string, any>();
  for (const [adsetId, ids] of adsetGroups) {
    const all = ids.map(id => adMetrics.get(id)!).filter(m => m.spend >= 15);
    if (all.length === 0) continue;
    const withCpa = all.filter(m => m.cpa > 0);
    const withLpCvr = all.filter(m => m.lp_cvr > 0);
    const withCpc = all.filter(m => m.cpc > 0);
    adsetAvgs.set(adsetId, {
      cpa: avg(withCpa.map(m => m.cpa)),
      link_ctr: avg(all.map(m => m.link_ctr)),
      lp_cvr: avg(withLpCvr.map(m => m.lp_cvr)),
      cpc: avg(withCpc.map(m => m.cpc)),
    });
  }

  // ── Score each ad ─────────────────────────────────────────────────────────
  const scoreRows: any[] = [];

  for (const [adId, m] of adMetrics) {
    const adAvg = adsetAvgs.get(m.adset_id) || { cpa: 0, link_ctr: 0, lp_cvr: 0, cpc: 0 };

    // Learning check
    const isLearning =
      m.impressions < 2000 ||
      m.spend < 30 ||
      (m.conversion_mode !== 'traffic' && m.conversions_count < 3);

    // Metric scores
    const cpaScore = m.cpa > 0 && adAvg.cpa > 0 ? scoreRelative(m.cpa, adAvg.cpa, false) : 50;
    const linkCtrScore = scoreRelative(m.link_ctr, adAvg.link_ctr, true);
    const lpCvrScore = m.lp_cvr > 0 && adAvg.lp_cvr > 0 ? scoreRelative(m.lp_cvr, adAvg.lp_cvr, true) : 50;
    const cpcScore = m.cpc > 0 && adAvg.cpc > 0 ? scoreRelative(m.cpc, adAvg.cpc, false) : 50;
    const freqScore = frequencyScore(m.frequency);

    // Weighted score
    let finalScore: number;
    const hasConversions = m.conversion_mode !== 'traffic' && m.cpa > 0 && adAvg.cpa > 0;

    if (hasConversions) {
      finalScore = cpaScore * 0.35 + linkCtrScore * 0.20 + lpCvrScore * 0.20 + cpcScore * 0.15 + freqScore * 0.10;
    } else {
      finalScore = linkCtrScore * 0.45 + lpCvrScore * 0.30 + cpcScore * 0.20 + freqScore * 0.05;
    }

    // Video hook rate bonus/penalty
    if (m.hook_rate > 0) {
      if (m.hook_rate > 0.25) finalScore += 5;
      else if (m.hook_rate < 0.10) finalScore -= 10;
    }

    finalScore = Math.max(0, Math.min(100, Math.round(finalScore)));

    // Status
    let status = 'Learning';
    if (!isLearning) {
      if (finalScore >= 70) status = 'Winner';
      else if (finalScore >= 55) status = 'Good';
      else if (finalScore >= 40) status = 'Risk';
      else status = 'Bad';
    }

    // ── Generate actionable reasons ───────────────────────────────────────
    const reasons: string[] = [];

    // CPA / CPL
    if (m.cpa > 0 && adAvg.cpa > 0) {
      const label = m.conversion_mode === 'lead' ? 'CPL' : 'CPA';
      const ratio = (adAvg.cpa - m.cpa) / adAvg.cpa;
      if (ratio > 0.3) reasons.push(`${label} ${fmt(m.cpa)} vs. ${fmt(adAvg.cpa)} médio — ${Math.round(ratio * 100)}% mais eficiente`);
      else if (ratio < -0.3) reasons.push(`${label} ${fmt(m.cpa)} vs. ${fmt(adAvg.cpa)} médio — ${Math.round(-ratio * 100)}% acima do adset`);
    }

    // Link CTR
    if (adAvg.link_ctr > 0) {
      const ratio = (m.link_ctr - adAvg.link_ctr) / adAvg.link_ctr;
      if (ratio > 0.3) reasons.push(`Link CTR ${m.link_ctr.toFixed(2)}% — ${Math.round(ratio * 100)}% acima do adset, criativo forte`);
      else if (ratio < -0.3) reasons.push(`Link CTR ${m.link_ctr.toFixed(2)}% — ${Math.round(-ratio * 100)}% abaixo do adset`);
    }

    // LP CVR
    if (m.lp_cvr > 0 && adAvg.lp_cvr > 0) {
      const ratio = (m.lp_cvr - adAvg.lp_cvr) / adAvg.lp_cvr;
      if (ratio < -0.4) reasons.push(`Taxa LP ${pct(m.lp_cvr)} vs. ${pct(adAvg.lp_cvr)} do adset — verifique a landing page`);
      else if (ratio > 0.4) reasons.push(`Taxa LP ${pct(m.lp_cvr)} — ${Math.round(ratio * 100)}% acima do adset`);
    }

    // Hook rate (video)
    if (m.hook_rate > 0) {
      const hrPct = (m.hook_rate * 100).toFixed(1);
      if (m.hook_rate < 0.10) reasons.push(`Hook Rate ${hrPct}% — vídeo não prende nos primeiros 3s, revise a abertura`);
      else if (m.hook_rate > 0.25) reasons.push(`Hook Rate ${hrPct}% — abertura forte, para o scroll`);
    }

    // Frequency
    if (m.frequency > 4) reasons.push(`Frequência ${m.frequency.toFixed(1)} — fadiga de audiência, crie uma variação`);
    else if (m.frequency > 3) reasons.push(`Frequência ${m.frequency.toFixed(1)} — início de fadiga, monitore`);

    // CPC (only if no better reasons yet)
    if (m.cpc > 0 && adAvg.cpc > 0 && reasons.length < 3) {
      const ratio = (adAvg.cpc - m.cpc) / adAvg.cpc;
      if (ratio < -0.3) reasons.push(`CPC ${fmt(m.cpc)} — ${Math.round(-ratio * 100)}% acima do adset`);
      else if (ratio > 0.3) reasons.push(`CPC ${fmt(m.cpc)} — ${Math.round(ratio * 100)}% abaixo do adset`);
    }

    // ROAS (purchase only)
    if (m.conversion_mode === 'purchase' && m.roas > 0 && reasons.length < 4) {
      if (m.roas >= 3) reasons.push(`ROAS ${m.roas.toFixed(1)}x — retorno excelente`);
      else if (m.roas < 1 && m.spend > 50) reasons.push(`ROAS ${m.roas.toFixed(1)}x — retorno abaixo de 1x`);
    }

    if (isLearning) reasons.push('Dados insuficientes para análise completa');
    if (reasons.length === 0) reasons.push('Performance dentro da média do adset');

    scoreRows.push({
      account_id: accountTag,
      ad_id: adId,
      adset_id: m.adset_id,
      date: today,
      score: finalScore,
      status,
      reasons,
      conversion_mode: m.conversion_mode,
      leads_count: m.leads,
      cpl: m.cpl,
      roas: m.roas,
      link_ctr: m.link_ctr,
      lp_cvr: m.lp_cvr,
      hook_rate: m.hook_rate,
      adset_avg_cpa: adAvg.cpa,
      adset_avg_link_ctr: adAvg.link_ctr,
    });
  }

  if (scoreRows.length > 0) {
    await supabase.from('creative_scores').upsert(scoreRows, { onConflict: 'ad_id,date' });
  }
}
