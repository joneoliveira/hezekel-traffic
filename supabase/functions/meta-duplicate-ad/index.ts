import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GRAPH_BASE = 'https://graph.facebook.com/v25.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ad-id, x-account-id',
};

// ─── Meta API Error ───────────────────────────────────────────────────────────

interface MetaErrorPayload {
  message: string; type?: string; code?: number;
  error_user_title?: string; error_user_msg?: string;
}

class MetaApiError extends Error {
  readonly meta: MetaErrorPayload;
  constructor(context: string, payload: MetaErrorPayload) {
    const detail = payload.error_user_msg || payload.error_user_title || payload.message || 'Erro desconhecido';
    super(`[${context}] ${detail}`);
    this.meta = payload;
  }
}

function throwIfMetaError(context: string, data: { error?: MetaErrorPayload }) {
  if (data.error) throw new MetaApiError(context, data.error);
}

// ─── Streaming helpers ────────────────────────────────────────────────────────

type StepEvent =
  | { type: 'step'; step: number; label: string }
  | { type: 'done'; adId: string; name: string }
  | { type: 'error'; message: string; metaError?: MetaErrorPayload };

function encode(event: StepEvent): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(event) + '\n');
}

// ─── Meta API functions ───────────────────────────────────────────────────────

async function getAd(token: string, adId: string) {
  const url = new URL(`${GRAPH_BASE}/${adId}`);
  url.searchParams.set('fields', 'id,name,status,creative{id,name,thumbnail_url,image_url,video_id,object_story_spec},adset{id,name},campaign{id,name}');
  url.searchParams.set('access_token', token);
  const data = await fetch(url.toString()).then(r => r.json());
  throwIfMetaError('getAd', data);
  return data;
}

async function getCreativeDetails(token: string, creativeId: string) {
  const url = new URL(`${GRAPH_BASE}/${creativeId}`);
  url.searchParams.set('fields', 'id,name,thumbnail_url,image_url,video_id,object_story_spec,asset_feed_spec,image_hash,degrees_of_freedom_spec');
  url.searchParams.set('access_token', token);
  const data = await fetch(url.toString()).then(r => r.json());
  throwIfMetaError('getCreativeDetails', data);
  return data;
}

async function listAds(token: string, adAccountId: string) {
  const accountId = adAccountId.replace(/^act_/, '');
  const url = new URL(`${GRAPH_BASE}/act_${accountId}/ads`);
  url.searchParams.set('fields', 'id,name,adset{id,name}');
  url.searchParams.set('limit', '200');
  url.searchParams.set('access_token', token);
  const data = await fetch(url.toString()).then(r => r.json());
  throwIfMetaError('listAds', data);
  return data.data ?? [];
}

async function uploadImage(token: string, adAccountId: string, fileBytes: Uint8Array, fileName: string, mimeType: string) {
  const accountId = adAccountId.replace(/^act_/, '');
  const form = new FormData();
  form.append('access_token', token);
  form.append('filename', new Blob([fileBytes.buffer as ArrayBuffer], { type: mimeType }), fileName);
  const data = await fetch(`${GRAPH_BASE}/act_${accountId}/adimages`, { method: 'POST', body: form }).then(r => r.json());
  throwIfMetaError('uploadImage', data);
  const imageKey = Object.keys(data.images ?? {})[0];
  if (!imageKey) throw new Error('Falha ao obter hash da imagem');
  return data.images[imageKey] as { hash: string; url: string };
}

async function uploadVideo(token: string, adAccountId: string, fileBytes: Uint8Array, fileName: string, mimeType: string): Promise<{ id: string; thumbnailUrl: string | null }> {
  const accountId = adAccountId.replace(/^act_/, '');
  const endpoint = `${GRAPH_BASE}/act_${accountId}/advideos`;

  // Phase 1: Start — server returns first chunk boundaries
  const startForm = new FormData();
  startForm.append('access_token', token);
  startForm.append('upload_phase', 'start');
  startForm.append('file_size', String(fileBytes.length));
  const startData = await fetch(endpoint, { method: 'POST', body: startForm }).then(r => r.json());
  throwIfMetaError('uploadVideo:start', startData);
  const { upload_session_id, video_id } = startData;
  let startOffset = parseInt(startData.start_offset ?? '0', 10);
  let endOffset = parseInt(startData.end_offset ?? String(fileBytes.length), 10);

  // Phase 2: Transfer — loop chunk by chunk as the server dictates
  while (startOffset !== endOffset) {
    const chunk = fileBytes.slice(startOffset, endOffset);
    const transferForm = new FormData();
    transferForm.append('access_token', token);
    transferForm.append('upload_phase', 'transfer');
    transferForm.append('upload_session_id', upload_session_id);
    transferForm.append('start_offset', String(startOffset));
    transferForm.append('end_offset', String(endOffset));
    transferForm.append('video_file_chunk', new Blob([chunk.buffer as ArrayBuffer], { type: mimeType }), fileName);
    const transferData = await fetch(endpoint, { method: 'POST', body: transferForm }).then(r => r.json());
    throwIfMetaError('uploadVideo:transfer', transferData);
    startOffset = parseInt(transferData.start_offset, 10);
    endOffset = parseInt(transferData.end_offset, 10);
  }

  // Phase 3: Finish
  const finishForm = new FormData();
  finishForm.append('access_token', token);
  finishForm.append('upload_phase', 'finish');
  finishForm.append('upload_session_id', upload_session_id);
  const finishData = await fetch(endpoint, { method: 'POST', body: finishForm }).then(r => r.json());
  throwIfMetaError('uploadVideo:finish', finishData);

  // Poll until ready — every 5s, max 150s
  const statusUrl = new URL(`${GRAPH_BASE}/${video_id}`);
  statusUrl.searchParams.set('fields', 'status');
  statusUrl.searchParams.set('access_token', token);
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const s = await fetch(statusUrl.toString()).then(r => r.json());
    throwIfMetaError('uploadVideo:poll', s);
    if (s?.status?.video_status === 'ready') break;
    if (s?.status?.video_status === 'error') throw new Error('Vídeo retornou erro durante processamento na Meta.');
    if (i === 29) throw new Error('Tempo esgotado aguardando processamento do vídeo (150s). Tente com um arquivo menor ou aguarde alguns minutos e tente novamente.');
  }

  // Fetch auto-generated thumbnail (required by Meta in video_data)
  let thumbnailUrl: string | null = null;
  try {
    const thumbData = await fetch(`${GRAPH_BASE}/${video_id}?fields=picture&access_token=${token}`).then(r => r.json());
    thumbnailUrl = thumbData.picture ?? null;
  } catch { /* ignore */ }

  return { id: video_id, thumbnailUrl };
}

async function createCreative(
  token: string,
  adAccountId: string,
  name: string,
  objectStorySpec: Record<string, unknown>,
  degreesOfFreedomSpec?: Record<string, unknown> | null,
) {
  const accountId = adAccountId.replace(/^act_/, '');
  const body = new URLSearchParams();
  body.set('access_token', token);
  body.set('name', name);
  body.set('object_story_spec', JSON.stringify(objectStorySpec));
  if (degreesOfFreedomSpec && Object.keys(degreesOfFreedomSpec).length > 0) {
    body.set('degrees_of_freedom_spec', JSON.stringify(degreesOfFreedomSpec));
  }
  const data = await fetch(`${GRAPH_BASE}/act_${accountId}/adcreatives`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString(),
  }).then(r => r.json());
  throwIfMetaError('createCreative', data);
  return { id: data.id };
}

async function createAd(token: string, adAccountId: string, name: string, adsetId: string, creativeId: string) {
  const accountId = adAccountId.replace(/^act_/, '');
  const body = new URLSearchParams();
  body.set('access_token', token);
  body.set('name', name);
  body.set('adset_id', adsetId);
  body.set('creative', JSON.stringify({ creative_id: creativeId }));
  body.set('status', 'PAUSED');
  const data = await fetch(`${GRAPH_BASE}/act_${accountId}/ads`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString(),
  }).then(r => r.json());
  throwIfMetaError('createAd', data);
  return { id: data.id };
}

// ─── Naming ───────────────────────────────────────────────────────────────────

function generateVariantName(originalName: string, existingNames: string[]): string {
  const baseName = originalName.replace(/_VAR\d+$/, '');
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const usedNumbers = new Set<number>();
  for (const name of existingNames) {
    const match = name.match(new RegExp(`^${escape(baseName)}_VAR(\\d+)$`));
    if (match) usedNumbers.add(parseInt(match[1], 10));
  }
  let next = 1;
  while (usedNumbers.has(next)) next++;
  return `${baseName}_VAR${String(next).padStart(2, '0')}`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Get ad ID from header or URL
  const url = new URL(req.url);
  const adId = req.headers.get('x-ad-id') || url.searchParams.get('ad_id') || '';

  if (!adId) {
    return new Response(JSON.stringify({ type: 'error', message: 'ad_id é obrigatório' }) + '\n', {
      headers: { ...corsHeaders, 'Content-Type': 'application/x-ndjson' }, status: 400,
    });
  }

  // Get credentials from meta_accounts (by x-account-id header) or fallback to app_settings
  const xAccountId = req.headers.get('x-account-id') || '';
  let accessToken: string | undefined;
  let adAccountId: string | undefined;

  if (xAccountId) {
    const { data: accountRow } = await supabase
      .from('meta_accounts')
      .select('access_token, ad_account_id')
      .eq('ad_account_id', xAccountId)
      .single();
    accessToken = accountRow?.access_token;
    adAccountId = accountRow?.ad_account_id;
  }

  if (!accessToken || !adAccountId) {
    const { data: settings } = await supabase.from('app_settings').select('key,value').in('key', ['meta_access_token', 'meta_ad_account_id']);
    accessToken = settings?.find((r: any) => r.key === 'meta_access_token')?.value;
    adAccountId = settings?.find((r: any) => r.key === 'meta_ad_account_id')?.value;
  }

  if (!accessToken || !adAccountId) {
    return new Response(JSON.stringify({ type: 'error', message: 'Credenciais Meta não configuradas.' }) + '\n', {
      headers: { ...corsHeaders, 'Content-Type': 'application/x-ndjson' }, status: 400,
    });
  }

  // Parse form data
  const formData = await req.formData();
  const mediaFile = formData.get('media') as File | null;
  const customName = formData.get('name') as string | null;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const hasMedia = !!(mediaFile && mediaFile.size > 0);
        let uploadedVideoId: string | null = null;
        let uploadedVideoThumbnail: string | null = null;
        let uploadedImageHash: string | null = null;

        // Step 1: Upload
        if (hasMedia) {
          const isVideo = mediaFile!.type.startsWith('video/');
          controller.enqueue(encode({ type: 'step', step: 1, label: isVideo ? 'Fazendo upload do vídeo...' : 'Fazendo upload da imagem...' }));
          const bytes = new Uint8Array(await mediaFile!.arrayBuffer());
          if (isVideo) {
            const { id, thumbnailUrl } = await uploadVideo(accessToken, adAccountId, bytes, mediaFile!.name, mediaFile!.type);
            uploadedVideoId = id;
            uploadedVideoThumbnail = thumbnailUrl;
          } else {
            const { hash } = await uploadImage(accessToken, adAccountId, bytes, mediaFile!.name, mediaFile!.type);
            uploadedImageHash = hash;
          }
        } else {
          controller.enqueue(encode({ type: 'step', step: 1, label: 'Sem nova mídia, pulando upload...' }));
        }

        // Step 2: Read original ad
        controller.enqueue(encode({ type: 'step', step: 2, label: 'Lendo dados do anúncio original...' }));
        const sourceAd = await getAd(accessToken, adId);
        const adsetId = sourceAd.adset?.id;
        if (!adsetId) throw new Error('Ad set não encontrado no anúncio original');

        const creative = sourceAd.creative?.id
          ? await getCreativeDetails(accessToken, sourceAd.creative.id)
          : null;
        if (!creative) throw new Error('Creative não encontrado no anúncio original');

        // Step 3: Build new creative
        controller.enqueue(encode({ type: 'step', step: 3, label: 'Montando novo criativo...' }));

        type Obj = Record<string, any>;
        const rawSpec: Obj = creative.object_story_spec ?? {};
        const assetFeed: Obj = creative.asset_feed_spec ?? {};

        const hasChildAttachments = !!rawSpec.link_data?.child_attachments;
        if (hasChildAttachments) throw new Error('Duplicação de Carrossel não é suportada nesta versão.');

        const hasLinkData = !!rawSpec.link_data;
        const hasVideoData = !!rawSpec.video_data;
        const isAssetFeedAd = !hasLinkData && !hasVideoData;

        let objectStorySpec: Obj;

        if (isAssetFeedAd) {
          const linkUrl = assetFeed.link_urls?.[0]?.website_url ?? assetFeed.link_urls?.[0]?.display_url ?? '';
          if (!linkUrl) throw new Error('Não foi possível extrair o link deste anúncio Advantage+.');
          const message = assetFeed.bodies?.[0]?.text ?? '';
          const title = assetFeed.titles?.[0]?.text ?? '';
          const ctaType = assetFeed.call_to_action_types?.[0] ?? 'LEARN_MORE';
          const originalImageHash = assetFeed.images?.[0]?.hash ?? creative.image_hash ?? '';
          const originalVideoId = assetFeed.videos?.[0]?.video_id ?? creative.video_id ?? '';
          const finalVideoId = uploadedVideoId ?? (originalVideoId || null);
          const finalImageHash = uploadedImageHash ?? (originalImageHash || null);

          if (finalVideoId) {
            objectStorySpec = {
              page_id: rawSpec.page_id,
              ...(rawSpec.instagram_user_id ? { instagram_user_id: rawSpec.instagram_user_id } : {}),
              video_data: {
                video_id: finalVideoId,
                message,
                title,
                call_to_action: { type: ctaType, value: { link: linkUrl } },
                // Meta requires thumbnail; use uploaded thumbnail or fall back to original asset image
                ...(uploadedVideoThumbnail ? { image_url: uploadedVideoThumbnail }
                  : assetFeed.images?.[0]?.url ? { image_url: assetFeed.images[0].url } : {}),
              },
            };
          } else if (finalImageHash) {
            objectStorySpec = {
              page_id: rawSpec.page_id,
              ...(rawSpec.instagram_user_id ? { instagram_user_id: rawSpec.instagram_user_id } : {}),
              link_data: { image_hash: finalImageHash, link: linkUrl, message, name: title, call_to_action: { type: ctaType, value: { link: linkUrl } } },
            };
          } else {
            throw new Error('Este anúncio Advantage+ não possui imagem ou vídeo identificável.');
          }
        } else {
          objectStorySpec = { ...rawSpec };
          if (objectStorySpec.link_data) {
            const ld = objectStorySpec.link_data as Obj;
            if (!ld.link) { const ctaLink = ld.call_to_action?.value?.link; if (ctaLink) ld.link = ctaLink; }
            // Remove CDN image_url from link_data (expires); image_hash is preserved
            delete ld.image_url;
          }
          // Keep video_data.image_url (thumbnail) — Meta requires it and the CDN URL is valid at duplication time
          if (uploadedVideoId) {
            // Replace or set video — remove link_data if switching from image to video
            if (objectStorySpec.video_data) {
              objectStorySpec.video_data.video_id = uploadedVideoId;
              // Replace thumbnail with the one from the newly uploaded video
              if (uploadedVideoThumbnail) objectStorySpec.video_data.image_url = uploadedVideoThumbnail;
            } else {
              const ld = objectStorySpec.link_data as Obj | undefined;
              const link = ld?.link || ld?.call_to_action?.value?.link || '';
              const message = ld?.message || '';
              const ctaType = ld?.call_to_action?.type || 'LEARN_MORE';
              objectStorySpec.video_data = {
                video_id: uploadedVideoId,
                message,
                call_to_action: { type: ctaType, value: { link } },
                ...(uploadedVideoThumbnail ? { image_url: uploadedVideoThumbnail } : {}),
              };
              delete objectStorySpec.link_data;
            }
          } else if (uploadedImageHash) {
            if (objectStorySpec.video_data) {
              // Switching video → image: extract link/copy from video_data, remove video_data
              const vd = objectStorySpec.video_data as Obj;
              const link = vd.call_to_action?.value?.link || vd.link || '';
              const message = vd.message || '';
              const title = vd.title || vd.name || '';
              const ctaType = vd.call_to_action?.type || 'LEARN_MORE';
              objectStorySpec.link_data = {
                image_hash: uploadedImageHash,
                link,
                message,
                name: title,
                call_to_action: { type: ctaType, value: { link } },
              };
              delete objectStorySpec.video_data;
            } else if (objectStorySpec.link_data) {
              objectStorySpec.link_data.image_hash = uploadedImageHash;
              delete objectStorySpec.link_data.image_url;
            } else {
              objectStorySpec.link_data = { image_hash: uploadedImageHash };
            }
          }
        }

        // Only call listAds when no custom name is provided (avoids rate limiting on bulk uploads)
        let newAdName: string;
        if (customName?.trim()) {
          newAdName = customName.trim();
        } else {
          const allAds = await listAds(accessToken, adAccountId);
          const namesInAdset = allAds.filter((a: any) => a.adset?.id === adsetId).map((a: any) => a.name);
          newAdName = generateVariantName(sourceAd.name, namesInAdset);
        }

        // Step 4: Save creative
        controller.enqueue(encode({ type: 'step', step: 4, label: 'Salvando novo criativo na Meta...' }));

        // Strip deprecated standard_enhancements from degrees_of_freedom_spec (deprecated in v22+)
        let degreesOfFreedomSpec = creative.degrees_of_freedom_spec ?? null;
        if (degreesOfFreedomSpec?.creative_features_spec?.standard_enhancements !== undefined) {
          degreesOfFreedomSpec = {
            ...degreesOfFreedomSpec,
            creative_features_spec: Object.fromEntries(
              Object.entries(degreesOfFreedomSpec.creative_features_spec).filter(([k]) => k !== 'standard_enhancements')
            ),
          };
          if (Object.keys(degreesOfFreedomSpec.creative_features_spec).length === 0) {
            degreesOfFreedomSpec = null;
          }
        }

        const newCreative = await createCreative(accessToken, adAccountId, `${newAdName} - Creative`, objectStorySpec, degreesOfFreedomSpec);

        // Step 5: Publish ad
        controller.enqueue(encode({ type: 'step', step: 5, label: 'Publicando novo anúncio (Pausado)...' }));
        const newAd = await createAd(accessToken, adAccountId, newAdName, adsetId, newCreative.id);

        controller.enqueue(encode({ type: 'done', adId: newAd.id, name: newAdName }));
      } catch (err: any) {
        const metaError = err instanceof MetaApiError ? err.meta : undefined;
        controller.enqueue(encode({ type: 'error', message: err.message, metaError }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders, 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' },
  });
});
