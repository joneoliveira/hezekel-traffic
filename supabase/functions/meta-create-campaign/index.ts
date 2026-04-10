import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH = 'https://graph.facebook.com/v25.0';

// Send as multipart/form-data (same as curl -F), include full Meta error details
async function graphPost(path: string, token: string, body: Record<string, any>, step?: string) {
  const form = new FormData();
  form.append('access_token', token);
  for (const [k, v] of Object.entries(body)) {
    form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  const res = await fetch(`${GRAPH}${path}`, { method: 'POST', body: form });
  const data = await res.json();
  if (data.error) {
    const detail = data.error.error_user_msg || data.error.error_user_title || data.error.message || 'Erro desconhecido';
    const subcode = data.error.error_subcode ? ` [sub:${data.error.error_subcode}]` : '';
    const prefix = step ? `${step}: ` : '';
    throw new Error(`[Meta] ${prefix}${detail}${subcode}`);
  }
  return data;
}

async function uploadImage(accountId: string, token: string, fileName: string, bytes: Uint8Array, mimeType: string): Promise<string> {
  const form = new FormData();
  form.append('access_token', token);
  // Field name must be the filename (Meta uses it as key in the images response)
  form.append(fileName, new Blob([bytes.buffer as ArrayBuffer], { type: mimeType }), fileName);
  const res = await fetch(`${GRAPH}/act_${accountId}/adimages`, { method: 'POST', body: form });
  const data = await res.json();
  if (data.error) throw new Error(`[Meta] Upload de imagem falhou: ${data.error.message}`);
  const images = data.images ?? {};
  const firstKey = Object.keys(images)[0];
  if (!firstKey) throw new Error('Upload de imagem não retornou hash');
  return images[firstKey].hash;
}

async function uploadVideo(accountId: string, token: string, fileName: string, bytes: Uint8Array, mimeType: string): Promise<string> {
  const endpoint = `${GRAPH}/act_${accountId}/advideos`;

  // Phase 1: Start
  const startForm = new FormData();
  startForm.append('access_token', token);
  startForm.append('upload_phase', 'start');
  startForm.append('file_size', String(bytes.length));
  const startData = await fetch(endpoint, { method: 'POST', body: startForm }).then(r => r.json());
  if (startData.error) throw new Error(`[Meta] Upload de vídeo falhou (start): ${startData.error.message}`);
  const { upload_session_id, video_id } = startData;
  let startOffset = parseInt(startData.start_offset ?? '0', 10);
  let endOffset = parseInt(startData.end_offset ?? String(bytes.length), 10);

  // Phase 2: Transfer chunks
  while (startOffset !== endOffset) {
    const chunk = bytes.slice(startOffset, endOffset);
    const transferForm = new FormData();
    transferForm.append('access_token', token);
    transferForm.append('upload_phase', 'transfer');
    transferForm.append('upload_session_id', upload_session_id);
    transferForm.append('start_offset', String(startOffset));
    transferForm.append('end_offset', String(endOffset));
    transferForm.append('video_file_chunk', new Blob([chunk.buffer as ArrayBuffer], { type: mimeType }), fileName);
    const transferData = await fetch(endpoint, { method: 'POST', body: transferForm }).then(r => r.json());
    if (transferData.error) throw new Error(`[Meta] Upload de vídeo falhou (transfer): ${transferData.error.message}`);
    startOffset = parseInt(transferData.start_offset, 10);
    endOffset = parseInt(transferData.end_offset, 10);
  }

  // Phase 3: Finish
  const finishForm = new FormData();
  finishForm.append('access_token', token);
  finishForm.append('upload_phase', 'finish');
  finishForm.append('upload_session_id', upload_session_id);
  const finishData = await fetch(endpoint, { method: 'POST', body: finishForm }).then(r => r.json());
  if (finishData.error) throw new Error(`[Meta] Upload de vídeo falhou (finish): ${finishData.error.message}`);

  // Poll until ready (max 150s)
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const s = await fetch(`${GRAPH}/${video_id}?fields=status&access_token=${token}`).then(r => r.json());
    if (s?.status?.video_status === 'ready') break;
    if (s?.status?.video_status === 'error') throw new Error('Vídeo retornou erro durante processamento na Meta.');
    if (i === 29) throw new Error('Tempo esgotado aguardando processamento do vídeo (150s). Tente com um arquivo menor ou aguarde e tente novamente.');
  }
  return video_id;
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
    const mediaFiles: { name: string; bytes: Uint8Array; type: string }[] = [];

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      params = JSON.parse(form.get('data') as string);
      let i = 0;
      while (true) {
        const file = form.get(`media_${i}`) as File | null;
        if (!file) break;
        mediaFiles.push({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()), type: file.type || 'application/octet-stream' });
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
    const isCBO = !!(campaign.daily_budget);

    // ── 1. Create Campaign ────────────────────────────────────────────────────
    const campaignRes = await graphPost(`/act_${accountId}/campaigns`, token, {
      name: campaign.name,
      objective: campaign.objective,
      status: campaign.status ?? 'PAUSED',
      special_ad_categories: [],
      ...(isCBO ? { daily_budget: Math.round(campaign.daily_budget * 100) } : {}),
    }, 'Campanha');
    const campaignId = campaignRes.id;

    // ── 2. Create Ad Set ──────────────────────────────────────────────────────
    const targeting = {
      geo_locations: { countries: adset.countries ?? ['BR'] },
      age_min: adset.age_min ?? 18,
      age_max: adset.age_max ?? 65,
      ...(adset.genders?.length ? { genders: adset.genders } : {}),
    };

    console.log('[create-campaign] adset received:', JSON.stringify({ bid_strategy: adset.bid_strategy, bid_amount: adset.bid_amount, bid_constraints: adset.bid_constraints }));

    // Validate bid fields before creating campaign (avoid orphaned campaigns)
    const BID_AMOUNT_STRATEGIES = ['LOWEST_COST_WITH_BID_CAP', 'COST_CAP'];
    if (adset.bid_strategy && BID_AMOUNT_STRATEGIES.includes(adset.bid_strategy) && adset.bid_amount == null) {
      throw new Error(`Conjunto: bid_amount é obrigatório para bid_strategy="${adset.bid_strategy}" mas não foi recebido. Verifique se o anúncio de template possui limite de lance configurado.`);
    }

    const adsetPayload: Record<string, any> = {
      name: adset.name,
      campaign_id: campaignId,
      status: adset.status ?? 'PAUSED',
      billing_event: 'IMPRESSIONS',
      optimization_goal: adset.optimization_goal,
      targeting,
      ...(adset.start_time ? { start_time: adset.start_time } : {}),
      ...(adset.promoted_object ? { promoted_object: adset.promoted_object } : {}),
      ...(adset.bid_strategy ? { bid_strategy: adset.bid_strategy } : {}),
      ...(adset.bid_amount != null ? { bid_amount: adset.bid_amount } : {}),
      ...(adset.bid_constraints != null ? { bid_constraints: adset.bid_constraints } : {}),
    };
    if (!isCBO) {
      if (adset.lifetime_budget) {
        adsetPayload.lifetime_budget = Math.round(adset.lifetime_budget * 100);
      } else {
        adsetPayload.daily_budget = Math.round((adset.daily_budget ?? 50) * 100);
      }
    }
    if (adset.end_time) adsetPayload.end_time = adset.end_time;

    const adsetRes = await graphPost(`/act_${accountId}/adsets`, token, adsetPayload, 'Conjunto');
    const adsetId = adsetRes.id;

    // ── 3+4. Create Creative(s) + Ad(s) ──────────────────────────────────────
    const createdAds: { ad_id: string; creative_id: string; name: string }[] = [];

    // Builds object_story_spec for image or video ad
    function buildSpec(mediaKind: 'image' | 'video' | 'none', mediaRef?: string): Record<string, any> {
      const pageId = creative.page_id;
      const link = creative.link;
      const ctaType = creative.cta_type ?? 'LEARN_MORE';

      if (mediaKind === 'video') {
        const videoData: Record<string, any> = {
          video_id: mediaRef,
          call_to_action: { type: ctaType, value: { link } },
        };
        if (creative.message) videoData.message = creative.message;
        if (creative.headline) videoData.title = creative.headline;
        return { page_id: pageId, video_data: videoData };
      }

      // image or no-media → link_data
      const linkData: Record<string, any> = {
        link,
        call_to_action: { type: ctaType, value: { link } },
      };
      if (creative.message) linkData.message = creative.message;
      if (creative.headline) linkData.name = creative.headline;
      if (creative.description) linkData.description = creative.description;
      // Prefer uploaded hash → template hash → image_url (never use CDN URLs from Facebook, they expire)
      if (mediaRef) {
        linkData.image_hash = mediaRef;
      } else if (creative.image_hash) {
        linkData.image_hash = creative.image_hash;
      } else if (creative.image_url) {
        linkData.image_url = creative.image_url;
      }
      return { page_id: pageId, link_data: linkData };
    }

    async function createOneAd(adName: string, spec: Record<string, any>) {
      const creativeRes = await graphPost(`/act_${accountId}/adcreatives`, token, {
        name: `Criativo - ${adName}`,
        object_story_spec: spec,
      }, `Criativo "${adName}"`);

      const adRes = await graphPost(`/act_${accountId}/ads`, token, {
        name: adName,
        adset_id: adsetId,
        creative: { creative_id: creativeRes.id },
        status: ad?.status ?? 'PAUSED',
      }, `Anúncio "${adName}"`);

      createdAds.push({ ad_id: adRes.id, creative_id: creativeRes.id, name: adName });
    }

    if (mediaFiles.length > 0) {
      for (const media of mediaFiles) {
        const isVideo = media.type.startsWith('video/');
        const adName = media.name.replace(/\.[^/.]+$/, '');
        if (isVideo) {
          const videoId = await uploadVideo(accountId, token, media.name, media.bytes, media.type);
          await createOneAd(adName, buildSpec('video', videoId));
        } else {
          const hash = await uploadImage(accountId, token, media.name, media.bytes, media.type);
          await createOneAd(adName, buildSpec('image', hash));
        }
      }
    } else {
      await createOneAd(ad?.name ?? campaign.name, buildSpec('none'));
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
