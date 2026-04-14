import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { imageUrl, adName, status, reasons, score } = await req.json();
    // Integração com serviço de geração de imagem (ex: OpenAI DALL-E, Stability AI)
    // Por ora retorna erro informativo
    return new Response(JSON.stringify({
      error: 'Configure a chave de API de geração de imagem (OPENAI_API_KEY ou STABILITY_API_KEY) nos secrets do Supabase.',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
