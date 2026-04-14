import { useState, useId, useRef, useEffect } from 'react';
import { Plus, Trash2, Play, Copy, Check, ChevronDown, ChevronUp, Pencil, Loader2, FileText, AlertCircle, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useReports,
  METRICS, METRIC_CATEGORIES,
  DATE_PRESET_LABELS, getDateRange,
  buildReportText, formatMetricValue,
  type ReportTemplate, type ReportSegment, type ReportConfig,
  type DatePreset, type MetricKey, type GeneratedReport,
} from '@/hooks/useReports';

// ── Tiny helpers ──────────────────────────────────────────────────────────────

function newSegmentId() {
  return Math.random().toString(36).slice(2, 9);
}

function emptySegment(): ReportSegment {
  return {
    id: newSegmentId(),
    emoji: '',
    label: '',
    campaign_contains: '',
    metrics: ['leads', 'spend', 'cpl'],
  };
}

function emptyConfig(): ReportConfig {
  return { date_preset: 'today', segments: [emptySegment()] };
}

// ── Metric selector (per segment) ────────────────────────────────────────────

function MetricSelector({
  selected,
  onChange,
}: {
  selected: MetricKey[];
  onChange: (keys: MetricKey[]) => void;
}) {
  function toggle(key: MetricKey) {
    onChange(
      selected.includes(key)
        ? selected.filter(k => k !== key)
        : [...selected, key]
    );
  }

  return (
    <div className="space-y-3">
      {METRIC_CATEGORIES.map(cat => {
        const catMetrics = METRICS.filter(m => m.category === cat);
        return (
          <div key={cat}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{cat}</p>
            <div className="flex flex-wrap gap-1.5">
              {catMetrics.map(m => {
                const active = selected.includes(m.key);
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => toggle(m.key)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                    )}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Emoji picker ──────────────────────────────────────────────────────────────

const COMMON_EMOJIS = [
  '🇧🇷','🇺🇸','🇪🇸','🇲🇽','🇦🇷','🇨🇴','🇨🇱','🇵🇹','🇫🇷','🇩🇪',
  '🇮🇹','🇬🇧','🇯🇵','🇰🇷','🇨🇳','🇦🇺','🇨🇦','🇮🇳','🇷🇺','🌍',
  '🔥','⚡','🚀','💡','🎯','📊','📈','💰','🛒','🎁',
  '✅','❌','⭐','💎','👑','🏆','🎪','🌟','💫','🔑',
  '📱','💻','🖥️','📧','📩','🔔','💬','🗣️','👥','🤝',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','❗','❓',
];

function EmojiPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full h-[34px] bg-background border border-border rounded-md text-lg flex items-center justify-center hover:border-primary/60 transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
        title="Escolher emoji"
      >
        {value || <span className="text-muted-foreground text-xs">+</span>}
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-popover border border-border rounded-lg shadow-xl p-2 w-56">
          <div className="grid grid-cols-10 gap-0.5">
            {COMMON_EMOJIS.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => { onChange(e); setOpen(false); }}
                className="w-5 h-5 text-sm flex items-center justify-center rounded hover:bg-muted transition-colors"
              >
                {e}
              </button>
            ))}
          </div>
          {value && (
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground text-center py-1 hover:bg-muted rounded transition-colors"
            >
              Remover emoji
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Segment editor ────────────────────────────────────────────────────────────

function SegmentEditor({
  segment,
  index,
  total,
  onChange,
  onRemove,
}: {
  segment: ReportSegment;
  index: number;
  total: number;
  onChange: (seg: ReportSegment) => void;
  onRemove: () => void;
}) {
  const [metricsOpen, setMetricsOpen] = useState(false);

  function set(key: keyof ReportSegment, value: any) {
    onChange({ ...segment, [key]: value });
  }

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Segment header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30 border-b border-border">
        <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
        <span className="text-xs font-semibold text-muted-foreground flex-1">Segmento {index + 1}</span>
        {total > 1 && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="p-3 space-y-3">
        {/* Emoji + Label */}
        <div className="flex gap-2">
          <div className="w-16">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">Emoji</label>
            <EmojiPicker value={segment.emoji} onChange={v => set('emoji', v)} />
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">Nome do relatório</label>
            <input
              type="text"
              value={segment.label}
              onChange={e => set('label', e.target.value)}
              placeholder="Ex: BR (Português)"
              className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Campaign filter */}
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">
            Filtro de campanha <span className="normal-case font-normal">(deixe vazio para todas)</span>
          </label>
          <input
            type="text"
            value={segment.campaign_contains}
            onChange={e => set('campaign_contains', e.target.value)}
            placeholder="Ex: BR, ES, Black Friday..."
            className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Metrics toggle */}
        <div>
          <button
            type="button"
            onClick={() => setMetricsOpen(!metricsOpen)}
            className="w-full flex items-center justify-between text-[10px] font-medium text-muted-foreground uppercase tracking-wide"
          >
            <span>Métricas <span className="normal-case font-normal text-foreground">({segment.metrics.length} selecionadas)</span></span>
            {metricsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {metricsOpen && (
            <div className="mt-2 p-3 rounded-md bg-background border border-border">
              <MetricSelector
                selected={segment.metrics}
                onChange={keys => set('metrics', keys)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Template builder modal ────────────────────────────────────────────────────

function TemplateBuilder({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: ReportTemplate;
  onSave: (data: { name: string; config: ReportConfig; id?: string }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [config, setConfig] = useState<ReportConfig>(
    initial?.config ?? emptyConfig()
  );

  function updateSegment(idx: number, seg: ReportSegment) {
    setConfig(c => ({
      ...c,
      segments: c.segments.map((s, i) => i === idx ? seg : s),
    }));
  }

  function removeSegment(idx: number) {
    setConfig(c => ({ ...c, segments: c.segments.filter((_, i) => i !== idx) }));
  }

  function addSegment() {
    setConfig(c => ({ ...c, segments: [...c.segments, emptySegment()] }));
  }

  function handleSave() {
    if (!name.trim()) return;
    onSave({ name: name.trim(), config, id: initial?.id });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-card border border-border rounded-xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
          <h2 className="text-base font-semibold">{initial ? 'Editar template' : 'Novo template'}</h2>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1">Nome do relatório</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Daily BR/ES"
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>

          {/* Date preset */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1">Período padrão</label>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(DATE_PRESET_LABELS) as DatePreset[]).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setConfig(c => ({ ...c, date_preset: p }))}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                    config.date_preset === p
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                  )}
                >
                  {DATE_PRESET_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Time */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1">
              Hora <span className="normal-case font-normal">(opcional — aparece no cabeçalho)</span>
            </label>
            <input
              type="time"
              value={config.time ?? ''}
              onChange={e => setConfig(c => ({ ...c, time: e.target.value || undefined }))}
              className="bg-background border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
            />
          </div>

          {/* Segments */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground block mb-2">Segmentos</label>
            <div className="space-y-2">
              {config.segments.map((seg, idx) => (
                <SegmentEditor
                  key={seg.id}
                  segment={seg}
                  index={idx}
                  total={config.segments.length}
                  onChange={s => updateSegment(idx, s)}
                  onRemove={() => removeSegment(idx)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={addSegment}
              className="mt-2 w-full flex items-center justify-center gap-2 border border-dashed border-border rounded-lg py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adicionar segmento
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Salvar template
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Generated report modal ────────────────────────────────────────────────────

function ReportModal({
  report,
  onClose,
}: {
  report: GeneratedReport;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = buildReportText(report);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const { since, until } = getDateRange(report.template.config.date_preset);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl w-full max-w-lg flex flex-col shadow-2xl max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-semibold">{report.template.name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {DATE_PRESET_LABELS[report.template.config.date_preset]}
              {since !== until ? ` · ${since} → ${until}` : ` · ${since}`}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none">✕</button>
        </div>

        {/* Segments */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {report.segments.map((gen, i) => (
            <div key={gen.segment.id} className="space-y-1">
              <p className="text-sm font-semibold">
                {gen.segment.emoji && <span className="mr-1.5">{gen.segment.emoji}</span>}
                {gen.segment.label || `Segmento ${i + 1}`}
              </p>
              {gen.error ? (
                <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {gen.error}
                </div>
              ) : gen.data ? (
                <div className="space-y-0.5 pl-2">
                  {gen.segment.metrics.map(key => {
                    const def = METRICS.find(m => m.key === key);
                    if (!def || !gen.data) return null;
                    const val = (gen.data as any)[key] as number;
                    return (
                      <p key={key} className="text-sm text-muted-foreground">
                        <span className="text-muted-foreground/50 mr-1">·</span>
                        <span className="text-foreground/70">{def.label}:</span>
                        {' '}
                        <span className="font-medium text-foreground">{formatMetricValue(key, val)}</span>
                      </p>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {/* Footer with copy */}
        <div className="px-5 py-4 border-t border-border flex items-center justify-between shrink-0">
          <p className="text-xs text-muted-foreground">
            Gerado às {report.generatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <button
            onClick={handleCopy}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all',
              copied
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-primary text-primary-foreground hover:opacity-90'
            )}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado!' : 'Copiar relatório'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onGenerate,
  onEdit,
  onDelete,
  generating,
}: {
  template: ReportTemplate;
  onGenerate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  generating: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { config } = template;

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 hover:border-border/80 transition-colors">
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">{template.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{DATE_PRESET_LABELS[config.date_preset]}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Editar"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => { onDelete(); setConfirmDelete(false); }}
                className="px-2 py-1 rounded text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors font-medium"
              >
                Confirmar
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Excluir"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Segments preview */}
      <div className="flex flex-wrap gap-1.5">
        {config.segments.map(seg => (
          <span
            key={seg.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-xs text-muted-foreground"
          >
            {seg.emoji && <span>{seg.emoji}</span>}
            <span>{seg.label || 'Sem nome'}</span>
            <span className="text-muted-foreground/50">·</span>
            <span>{seg.metrics.length} métricas</span>
          </span>
        ))}
      </div>

      {/* Generate button */}
      <button
        onClick={onGenerate}
        disabled={generating}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
      >
        {generating
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
          : <><Play className="w-4 h-4" /> Gerar relatório</>
        }
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { templates, loading, saving, saveTemplate, deleteTemplate, generateReport } = useReports();

  const [builderOpen, setBuilderOpen]         = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | null>(null);
  const [report, setReport]                   = useState<GeneratedReport | null>(null);
  const [generating, setGenerating]           = useState<string | null>(null);
  const [genError, setGenError]               = useState<string | null>(null);

  async function handleGenerate(template: ReportTemplate) {
    setGenerating(template.id);
    setGenError(null);
    try {
      const result = await generateReport(template);
      setReport(result);
    } catch (e: any) {
      setGenError(e.message ?? 'Erro ao gerar relatório');
    } finally {
      setGenerating(null);
    }
  }

  async function handleSave(data: { name: string; config: ReportConfig; id?: string }) {
    const { error } = await saveTemplate(data);
    if (!error) {
      setBuilderOpen(false);
      setEditingTemplate(null);
    }
  }

  function openEdit(template: ReportTemplate) {
    setEditingTemplate(template);
    setBuilderOpen(true);
  }

  function closeBuilder() {
    setBuilderOpen(false);
    setEditingTemplate(null);
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure seus relatórios uma vez e gere com um clique.
          </p>
        </div>
        <button
          onClick={() => { setEditingTemplate(null); setBuilderOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Novo template
        </button>
      </div>

      {/* Error banner */}
      {genError && (
        <div className="mb-4 flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {genError}
        </div>
      )}

      {/* Template list */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Carregando...
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <FileText className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="font-semibold text-sm mb-1">Nenhum template ainda</p>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            Crie seu primeiro template para gerar relatórios com um clique.
          </p>
          <button
            onClick={() => setBuilderOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Criar primeiro template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onGenerate={() => handleGenerate(template)}
              onEdit={() => openEdit(template)}
              onDelete={() => deleteTemplate(template.id)}
              generating={generating === template.id}
            />
          ))}
        </div>
      )}

      {/* Builder modal */}
      {builderOpen && (
        <TemplateBuilder
          initial={editingTemplate ?? undefined}
          onSave={handleSave}
          onCancel={closeBuilder}
          saving={saving}
        />
      )}

      {/* Report modal */}
      {report && (
        <ReportModal
          report={report}
          onClose={() => setReport(null)}
        />
      )}
    </div>
  );
}
