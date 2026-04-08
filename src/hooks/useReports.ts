import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAccountContext } from '@/contexts/AccountContext';
import { useClientContext } from '@/contexts/ClientContext';
import { useAuth } from '@/contexts/AuthContext';

// ── Metric definitions ────────────────────────────────────────────────────────

export type MetricKey =
  | 'spend' | 'impressions' | 'reach' | 'frequency' | 'cpm'
  | 'clicks' | 'link_clicks' | 'cpc' | 'ctr' | 'link_ctr' | 'landing_page_views'
  | 'leads' | 'conversions' | 'revenue' | 'cpl' | 'cpa' | 'roas' | 'connect_rate' | 'lp_cvr'
  | 'video_thruplay' | 'hook_rate' | 'video_p25' | 'video_p50' | 'video_p75' | 'video_p100';

export interface MetricDef {
  key: MetricKey;
  label: string;
  category: string;
  format: 'currency' | 'percent' | 'number' | 'decimal';
}

export const METRICS: MetricDef[] = [
  // Investimento
  { key: 'spend',              label: 'Investimento',    category: 'Investimento', format: 'currency' },
  { key: 'cpm',                label: 'CPM',             category: 'Investimento', format: 'currency' },
  // Alcance
  { key: 'impressions',        label: 'Impressões',      category: 'Alcance',      format: 'number' },
  { key: 'reach',              label: 'Alcance',         category: 'Alcance',      format: 'number' },
  { key: 'frequency',          label: 'Frequência',      category: 'Alcance',      format: 'decimal' },
  // Cliques
  { key: 'clicks',             label: 'Cliques Totais',  category: 'Cliques',      format: 'number' },
  { key: 'link_clicks',        label: 'Cliques no Link', category: 'Cliques',      format: 'number' },
  { key: 'cpc',                label: 'CPC',             category: 'Cliques',      format: 'currency' },
  { key: 'ctr',                label: 'CTR Geral',       category: 'Cliques',      format: 'percent' },
  { key: 'link_ctr',           label: 'CTR do Link',     category: 'Cliques',      format: 'percent' },
  { key: 'landing_page_views', label: 'Views de LP',     category: 'Cliques',      format: 'number' },
  // Conversão
  { key: 'leads',              label: 'Leads',           category: 'Conversão',    format: 'number' },
  { key: 'conversions',        label: 'Conversões',      category: 'Conversão',    format: 'number' },
  { key: 'revenue',            label: 'Receita',         category: 'Conversão',    format: 'currency' },
  { key: 'cpl',                label: 'CPL',             category: 'Conversão',    format: 'currency' },
  { key: 'cpa',                label: 'CPA',             category: 'Conversão',    format: 'currency' },
  { key: 'roas',               label: 'ROAS',            category: 'Conversão',    format: 'decimal' },
  { key: 'connect_rate',       label: 'Connect Rate',    category: 'Conversão',    format: 'percent' },
  { key: 'lp_cvr',             label: 'LP CVR',          category: 'Conversão',    format: 'percent' },
  // Vídeo
  { key: 'video_thruplay',     label: 'Thruplay',        category: 'Vídeo',        format: 'number' },
  { key: 'hook_rate',          label: 'Hook Rate',       category: 'Vídeo',        format: 'percent' },
  { key: 'video_p25',          label: 'Retenção 25%',    category: 'Vídeo',        format: 'number' },
  { key: 'video_p50',          label: 'Retenção 50%',    category: 'Vídeo',        format: 'number' },
  { key: 'video_p75',          label: 'Retenção 75%',    category: 'Vídeo',        format: 'number' },
  { key: 'video_p100',         label: 'Conclusão',       category: 'Vídeo',        format: 'number' },
];

export const METRIC_CATEGORIES = ['Investimento', 'Alcance', 'Cliques', 'Conversão', 'Vídeo'];

export function formatMetricValue(key: MetricKey, value: number): string {
  const def = METRICS.find(m => m.key === key);
  if (!def) return String(value);
  if (def.format === 'currency') {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  if (def.format === 'percent') {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  }
  if (def.format === 'decimal') {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return value.toLocaleString('pt-BR');
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type DatePreset = 'today' | 'yesterday' | 'last_7d' | 'last_30d';

export interface ReportSegment {
  id: string;
  emoji: string;
  label: string;
  campaign_contains: string;
  metrics: MetricKey[];
}

export interface ReportConfig {
  date_preset: DatePreset;
  time?: string;
  segments: ReportSegment[];
}

export interface ReportTemplate {
  id: string;
  name: string;
  config: ReportConfig;
  created_at: string;
}

export interface SegmentData {
  spend: number; impressions: number; clicks: number; reach: number;
  leads: number; conversions: number; revenue: number;
  link_clicks: number; landing_page_views: number;
  video_thruplay: number; video_3s: number;
  video_p25: number; video_p50: number; video_p75: number; video_p100: number;
  // derived
  cpm: number; cpc: number; ctr: number; link_ctr: number; frequency: number;
  cpl: number; cpa: number; roas: number; connect_rate: number; lp_cvr: number;
  hook_rate: number;
}

export interface GeneratedSegment {
  segment: ReportSegment;
  data: SegmentData | null;
  error: string | null;
}

export interface GeneratedReport {
  template: ReportTemplate;
  segments: GeneratedSegment[];
  generatedAt: Date;
  since: string;
  until: string;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0];
}
function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}
function yesterdayStr() {
  return daysAgoStr(1);
}

export function getDateRange(preset: DatePreset): { since: string; until: string } {
  if (preset === 'today')     return { since: todayStr(),      until: todayStr() };
  if (preset === 'yesterday') return { since: yesterdayStr(),  until: yesterdayStr() };
  if (preset === 'last_7d')   return { since: daysAgoStr(7),   until: todayStr() };
  if (preset === 'last_30d')  return { since: daysAgoStr(30),  until: todayStr() };
  return { since: todayStr(), until: todayStr() };
}

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  today:     'Hoje',
  yesterday: 'Ontem',
  last_7d:   'Últimos 7 dias',
  last_30d:  'Últimos 30 dias',
};

// ── Report text formatter ─────────────────────────────────────────────────────

export function buildReportText(report: GeneratedReport): string {
  function fmtDate(iso: string) {
    const d = new Date(iso + 'T12:00:00');
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  const isRange = ['last_7d', 'last_30d'].includes(report.template.config.date_preset);
  const dateLabel = isRange
    ? `${fmtDate(report.since)} a ${fmtDate(report.until)}`
    : fmtDate(report.until);

  const configTime = report.template.config.time;
  const header = configTime ? `${dateLabel} - ${configTime}` : dateLabel;

  const lines: string[] = [header, ''];

  for (const gen of report.segments) {
    const seg = gen.segment;
    const prefix = seg.emoji ? `${seg.emoji} ` : '';
    lines.push(`${prefix}${seg.label}`);

    if (!gen.data) {
      lines.push(`· ${gen.error ?? 'Sem dados'}`);
    } else {
      for (const key of seg.metrics) {
        const def = METRICS.find(m => m.key === key);
        if (!def) continue;
        const val = (gen.data as any)[key] as number;
        lines.push(`· ${def.label}: ${formatMetricValue(key, val)}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useReports() {
  const { activeAccount }  = useAccountContext();
  const { activeClient }   = useClientContext();
  const { user }           = useAuth();

  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);

  // Load templates for active client
  const loadTemplates = useCallback(async () => {
    if (!activeClient?.id) { setTemplates([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('report_templates')
      .select('id, name, config, created_at')
      .eq('client_id', activeClient.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTemplates(data.map(row => ({
        id: row.id,
        name: row.name,
        config: row.config as ReportConfig,
        created_at: row.created_at,
      })));
    }
    setLoading(false);
  }, [activeClient?.id]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  // Save (create or update)
  async function saveTemplate(template: Omit<ReportTemplate, 'id' | 'created_at'> & { id?: string }) {
    if (!activeClient?.id || !user?.id) return { error: 'Sem cliente ativo' };
    setSaving(true);

    const payload = {
      client_id:  activeClient.id,
      created_by: user.id,
      name:       template.name,
      config:     template.config as any,
      updated_at: new Date().toISOString(),
    };

    let error: string | null = null;

    if (template.id) {
      const { error: e } = await supabase
        .from('report_templates')
        .update(payload)
        .eq('id', template.id);
      error = e?.message ?? null;
    } else {
      const { error: e } = await supabase
        .from('report_templates')
        .insert(payload);
      error = e?.message ?? null;
    }

    setSaving(false);
    if (!error) await loadTemplates();
    return { error };
  }

  // Delete
  async function deleteTemplate(id: string) {
    const { error } = await supabase
      .from('report_templates')
      .delete()
      .eq('id', id);
    if (!error) setTemplates(prev => prev.filter(t => t.id !== id));
    return { error: error?.message ?? null };
  }

  // Generate report — calls the report-feed edge function (service role, sem limite de linhas)
  async function generateReport(template: ReportTemplate): Promise<GeneratedReport> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const anonKey     = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

    const res = await fetch(`${supabaseUrl}/functions/v1/report-feed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        config:     template.config,
        account_id: activeAccount?.ad_account_id ?? '',
      }),
    });

    const result = await res.json();
    if (result.error) throw new Error(result.error);

    const generatedSegments: GeneratedSegment[] = (result.segments ?? []).map((s: any) => ({
      segment: s.segment,
      data:    s.data as SegmentData | null,
      error:   s.error ?? null,
    }));

    return {
      template,
      segments: generatedSegments,
      generatedAt: new Date(),
      since: result.since,
      until: result.until,
    };
  }

  return {
    templates, loading, saving,
    saveTemplate, deleteTemplate, generateReport,
    reload: loadTemplates,
  };
}
