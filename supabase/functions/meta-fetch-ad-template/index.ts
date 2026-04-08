import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH = 'https://graph.facebook.com/v20.0';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { ad_id, account_id } = await req.json();
    if (!ad_id || !account_id) throw new Error('ad_id e account_id obrigatórios');

    // Get token
    const { data: accountRow } = await supabase
      .from('meta_accounts')
      .select('access_token')
      .eq('ad_account_id', account_id)
      .single();

    let token = accountRow?.access_token;
    if (!token) {
      const { data: s } = await supabase.from('app_settings').select('value').eq('key', 'meta_access_token').single();
      token = s?.value;
    }
    if (!token) throw new Error('Token não configurado');

    // Fetch ad → creative + adset_id
    const adRes = await fetch(
      `${GRAPH}/${ad_id}?fields=creative{id,object_story_spec},adset_id&access_token=${token}`
    );
    const adData = await adRes.json();
    if (adData.error) throw new Error(adData.error.message);

    let pageId: string | null = adData.creative?.object_story_spec?.page_id ?? null;
    let imageHash: string | null = null;
    const adsetId = adData.adset_id ?? null;

    // Fetch creative directly for more reliable page_id + image_hash
    const creativeId = adData.creative?.id ?? null;
    if (creativeId) {
      const creativeRes = await fetch(
        `${GRAPH}/${creativeId}?fields=object_story_spec,image_hash&access_token=${token}`
      );
      const creativeData = await creativeRes.json();
      if (!creativeData.error) {
        if (creativeData.object_story_spec?.page_id) {
          pageId = creativeData.object_story_spec.page_id;
        }
        // image_hash can be at top level or inside link_data
        if (creativeData.image_hash) {
          imageHash = creativeData.image_hash;
        } else if (creativeData.object_story_spec?.link_data?.image_hash) {
          imageHash = creativeData.object_story_spec.link_data.image_hash;
        }
      }
    }

    // Fetch adset targeting
    let targeting: any = null;
    if (adsetId) {
      const adsetRes = await fetch(
        `${GRAPH}/${adsetId}?fields=targeting,optimization_goal,daily_budget,name,promoted_object,bid_strategy,bid_amount,bid_constraints&access_token=${token}`
      );
      const adsetData = await adsetRes.json();
      if (!adsetData.error) {
        targeting = {
          countries: adsetData.targeting?.geo_locations?.countries ?? ['BR'],
          age_min: adsetData.targeting?.age_min ?? 18,
          age_max: adsetData.targeting?.age_max ?? 65,
          genders: adsetData.targeting?.genders ?? [],
          optimization_goal: adsetData.optimization_goal ?? null,
          daily_budget: adsetData.daily_budget ? Math.round(adsetData.daily_budget / 100) : null,
          adset_name: adsetData.name ?? null,
          promoted_object: adsetData.promoted_object ?? null,
          bid_strategy: adsetData.bid_strategy ?? null,
          bid_amount: adsetData.bid_amount ?? null,
          bid_constraints: adsetData.bid_constraints ?? null,
        };
      }
    }

    return new Response(JSON.stringify({ ok: true, page_id: pageId, image_hash: imageHash, targeting }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
