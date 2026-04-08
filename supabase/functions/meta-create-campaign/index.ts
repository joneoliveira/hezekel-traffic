import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH = 'https://graph.facebook.com/v20.0';

async function graphPost(path: string, token: string, body: Record<string, any>) {
  const form = new URLSearchParams();
  form.set('access_token', token);
  for (const [k, v] of Object.entries(body)) {
    form.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  const res = await fetch(`${GRAPH}${path}`, { method: 'POST', body: form });
  const data = await res.json();
  if (data.error) throw new Error(`[Meta] ${data.error.message}`);
  return data;
}

async function uploadImage(accountId: string, token: string, fileName: string, bytes: Uint8Array): Promise<string> {
  const form = new FormData();
  form.append('access_token', token);
  form.append('filename', new Blob([bytes], { type: 'image/jpeg' }), fileName);
  const res = await fetch(`${GRAPH}/act_${accountId}/adimages`, { method: 'POST', body: form });
  const data = await res.json();
  if (data.error) throw new Error(`[Meta] Upload de imagem falhou: ${data.error.message}`);
  const images = data.images ?? {};
  const firstKey = Object.keys(images)[0];
  if (!firstKey) throw new Error('Upload de imagem não retornou hash');
  return images[firstKey].hash;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const contentType = req.headers.get('content-type') ?? '';
    let params: any;
    const mediaFiles: { name: string; bytes: Uint8Array }[] = [];

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      params = JSON.parse(form.get('data') as string);
      let i = 0;
      while (true) {
        const file = form.get(`media_${i}`) as File | null;
        if (!file) break;
        mediaFiles.push({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
        i++;
      }
    } else {
      params = await req.json();
    }

    const { account_id, campaign, adset, creative, ad } = params;
    if (!account_id) throw new Error('account_id obrigatório');

    // Validate required fields BEFORE any API calls to avoid orphaned campaigns/adsets
    if (!creative.page_id) {
      throw new Error('page_id não encontrado. Selecione um anúncio existente como base para auto-preencher a página vinculada.');
    }

    // Get token
    const { data: accountRow } = await supabase
      .from('meta_accounts')
      .select('access_token')
      .eq('ad_account_id', account_id)
      .single();

    let token = accountRow?.access_token;
    if (!token) {
      const { data: settings } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'meta_access_token')
        .single();
      token = settings?.value;
    }
    if (!token) throw new Error('Token Meta não configurado');

    const accountId = account_id.replace('act_', '');
    // CBO = budget on campaign; ABO = budget on adset. Can't have both.
    const isCBO = !!(campaign.daily_budget);

    // ── 1. Create Campaign ────────────────────────────────────────────────────
    const campaignRes = await graphPost(`/act_${accountId}/campaigns`, token, {
      name: campaign.name,
      objective: campaign.objective,
      status: campaign.status ?? 'PAUSED',
      special_ad_categories: [],
      ...(isCBO ? { daily_budget: Math.round(campaign.daily_budget * 100) } : {}),
    });
    const campaignId = campaignRes.id;

    // ── 2. Create Ad Set ──────────────────────────────────────────────────────
    const targeting = {
      geo_locations: { countries: adset.countries ?? ['BR'] },
      age_min: adset.age_min ?? 18,
      age_max: adset.age_max ?? 65,
      ...(adset.genders?.length ? { genders: adset.genders } : {}),
    };

    const adsetPayload: Record<string, any> = {
      name: adset.name,
      campaign_id: campaignId,
      status: adset.status ?? 'PAUSED',
      billing_event: 'IMPRESSIONS',
      optimization_goal: adset.optimization_goal,
      targeting,
      ...(adset.start_time ? { start_time: adset.start_time } : {}),
      ...(adset.promoted_object ? { promoted_object: adset.promoted_object } : {}),
    };
    // CBO mode: adset must NOT have daily_budget
    if (!isCBO) {
      adsetPayload.daily_budget = Math.round((adset.daily_budget ?? 50) * 100);
    }

    const adsetRes = await graphPost(`/act_${accountId}/adsets`, token, adsetPayload);
    const adsetId = adsetRes.id;

    // ── 3+4. Create Creative(s) + Ad(s) ──────────────────────────────────────
    const createdAds: { ad_id: string; creative_id: string; name: string }[] = [];

    const createOneAd = async (adName: string, imageHash?: string) => {
      if (!creative.page_id) throw new Error('page_id não encontrado. Selecione um anúncio como base para auto-preencher.');

      const linkData: Record<string, any> = {
        link: creative.link,
        call_to_action: { type: creative.cta_type ?? 'LEARN_MORE', value: { link: creative.link } },
      };
      if (creative.message) linkData.message = creative.message;
      if (creative.headline) linkData.name = creative.headline;
      if (creative.description) linkData.description = creative.description;
      // Prefer uploaded hash → template hash → image_url (never use CDN URLs from Facebook, they expire)
      if (imageHash) {
        linkData.image_hash = imageHash;
      } else if (creative.image_hash) {
        linkData.image_hash = creative.image_hash;
      } else if (creative.image_url) {
        linkData.image_url = creative.image_url;
      }

      const creativeRes = await graphPost(`/act_${accountId}/adcreatives`, token, {
        name: `Criativo - ${adName}`,
        object_story_spec: { page_id: creative.page_id, link_data: linkData },
      });

      const adRes = await graphPost(`/act_${accountId}/ads`, token, {
        name: adName,
        adset_id: adsetId,
        creative: { creative_id: creativeRes.id },
        status: ad?.status ?? 'PAUSED',
      });

      createdAds.push({ ad_id: adRes.id, creative_id: creativeRes.id, name: adName });
    };

    if (mediaFiles.length > 0) {
      for (const media of mediaFiles) {
        const hash = await uploadImage(accountId, token, media.name, media.bytes);
        const adName = media.name.replace(/\.[^/.]+$/, '');
        await createOneAd(adName, hash);
      }
    } else {
      await createOneAd(ad?.name ?? campaign.name);
    }

    return new Response(
      JSON.stringify({ ok: true, campaign_id: campaignId, adset_id: adsetId, ads: createdAds }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
