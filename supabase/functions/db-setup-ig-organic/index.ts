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
    const sql = `
      create table if not exists ig_organic_media (
        id text primary key,
        ig_account_id text not null,
        caption text,
        media_type text,
        media_product_type text,
        timestamp timestamptz,
        permalink text,
        thumbnail_url text,
        media_url text,
        synced_at timestamptz default now()
      );

      create table if not exists ig_organic_insights (
        media_id text primary key references ig_organic_media(id) on delete cascade,
        reach bigint default 0,
        views bigint default 0,
        likes bigint default 0,
        comments bigint default 0,
        shares bigint default 0,
        saved bigint default 0,
        total_interactions bigint default 0,
        avg_watch_time_ms bigint default 0,
        total_watch_time_ms bigint default 0,
        synced_at timestamptz default now()
      );

      alter table ig_organic_media enable row level security;
      alter table ig_organic_insights enable row level security;

      do $$ begin
        if not exists (select 1 from pg_policies where tablename='ig_organic_media' and policyname='authenticated read ig_organic_media') then
          create policy "authenticated read ig_organic_media" on ig_organic_media for select to authenticated using (true);
        end if;
        if not exists (select 1 from pg_policies where tablename='ig_organic_media' and policyname='service role all ig_organic_media') then
          create policy "service role all ig_organic_media" on ig_organic_media for all to service_role using (true);
        end if;
        if not exists (select 1 from pg_policies where tablename='ig_organic_insights' and policyname='authenticated read ig_organic_insights') then
          create policy "authenticated read ig_organic_insights" on ig_organic_insights for select to authenticated using (true);
        end if;
        if not exists (select 1 from pg_policies where tablename='ig_organic_insights' and policyname='service role all ig_organic_insights') then
          create policy "service role all ig_organic_insights" on ig_organic_insights for all to service_role using (true);
        end if;
      end $$;
    `;

    const { error } = await supabase.rpc('exec_sql', { sql }).catch(() => ({ error: null }));

    // Try direct query via pg
    const { data, error: err2 } = await supabase.from('ig_organic_media').select('id').limit(1);

    if (err2 && err2.code === '42P01') {
      return new Response(JSON.stringify({ error: 'Tables do not exist yet — run migration manually', sql }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, message: 'Tables ready' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
