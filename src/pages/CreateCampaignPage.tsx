import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAccountContext } from '@/contexts/AccountContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, CheckCircle2, AlertCircle, Megaphone, Users, Image as ImageIcon,
  ExternalLink, ChevronDown, ChevronUp, Upload, X, Film,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const OBJECTIVES = [
  { value: 'OUTCOME_TRAFFIC',     label: 'Tráfego',         desc: 'Direcionar pessoas para um site ou app' },
  { value: 'OUTCOME_LEADS',       label: 'Leads',           desc: 'Coletar informações de contato' },
  { value: 'OUTCOME_SALES',       label: 'Vendas',          desc: 'Gerar compras ou conversões' },
  { value: 'OUTCOME_AWARENESS',   label: 'Reconhecimento',  desc: 'Aumentar visibilidade da marca' },
  { value: 'OUTCOME_ENGAGEMENT',  label: 'Engajamento',     desc: 'Curtidas, comentários e compartilhamentos' },
];

const OPTIMIZATION_GOALS: Record<string, { value: string; label: string }[]> = {
  OUTCOME_TRAFFIC:    [{ value: 'LANDING_PAGE_VIEWS', label: 'Visualizações da página de destino' }, { value: 'LINK_CLICKS', label: 'Cliques no link' }],
  OUTCOME_LEADS:      [{ value: 'LEAD_GENERATION', label: 'Geração de leads' }, { value: 'OFFSITE_CONVERSIONS', label: 'Conversões' }],
  OUTCOME_SALES:      [{ value: 'OFFSITE_CONVERSIONS', label: 'Conversões' }, { value: 'VALUE', label: 'Valor de conversão' }],
  OUTCOME_AWARENESS:  [{ value: 'REACH', label: 'Alcance' }, { value: 'IMPRESSIONS', label: 'Impressões' }],
  OUTCOME_ENGAGEMENT: [{ value: 'POST_ENGAGEMENT', label: 'Engajamento com post' }, { value: 'LINK_CLICKS', label: 'Cliques no link' }],
};

const CTA_TYPES = [
  { value: 'LEARN_MORE',  label: 'Saiba mais' },
  { value: 'SHOP_NOW',    label: 'Comprar agora' },
  { value: 'SIGN_UP',     label: 'Cadastre-se' },
  { value: 'GET_QUOTE',   label: 'Solicite um orçamento' },
  { value: 'CONTACT_US',  label: 'Entre em contato' },
  { value: 'DOWNLOAD',    label: 'Baixar' },
  { value: 'APPLY_NOW',   label: 'Inscreva-se' },
  { value: 'GET_OFFER',   label: 'Ver oferta' },
  { value: 'WATCH_MORE',  label: 'Ver mais' },
];

const COUNTRIES = [
  { value: 'BR', label: 'Brasil' },
  { value: 'US', label: 'Estados Unidos' },
  { value: 'PT', label: 'Portugal' },
  { value: 'AR', label: 'Argentina' },
  { value: 'MX', label: 'México' },
  { value: 'CO', label: 'Colômbia' },
];

interface TemplateAd {
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  adset_name: string;
  destination_url: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
}

interface MediaItem {
  file: File;
  previewUrl: string;
}

interface CreatedAd { ad_id: string; creative_id: string; name: string }

export default function CreateCampaignPage() {
  const { activeAccount } = useAccountContext();
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Template ──────────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<TemplateAd[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [fetchingTemplate, setFetchingTemplate] = useState(false);

  // ── Campaign ──────────────────────────────────────────────────────────────
  const [campaignName, setCampaignName] = useState('');
  const [objective, setObjective] = useState('OUTCOME_TRAFFIC');
  const [campaignStatus, setCampaignStatus] = useState('PAUSED');
  const [campaignBudget, setCampaignBudget] = useState('');

  // ── Ad Set ────────────────────────────────────────────────────────────────
  const [adsetName, setAdsetName] = useState('');
  const [optimizationGoal, setOptimizationGoal] = useState('LANDING_PAGE_VIEWS');
  const [adsetBudget, setAdsetBudget] = useState('50');
  const [country, setCountry] = useState('BR');
  const [ageMin, setAgeMin] = useState('18');
  const [ageMax, setAgeMax] = useState('65');
  const [gender, setGender] = useState('0');

  // ── Ad Set extras ─────────────────────────────────────────────────────────
  const [promotedObject, setPromotedObject] = useState<Record<string, any> | null>(null);

  // ── Ad Creative ───────────────────────────────────────────────────────────
  const [adName, setAdName] = useState('');
  const [pageId, setPageId] = useState('');
  const [imageHash, setImageHash] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [primaryText, setPrimaryText] = useState('');
  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [ctaType, setCtaType] = useState('LEARN_MORE');

  // ── Media files ───────────────────────────────────────────────────────────
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // ── UI State ──────────────────────────────────────────────────────────────
  const [sections, setSections] = useState<Record<string, boolean>>({
    campaign: true, adset: true, creative: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean; msg: string;
    campaign_id?: string; adset_id?: string;
    ads?: CreatedAd[];
  } | null>(null);

  const isCBO = !!(campaignBudget && parseFloat(campaignBudget) > 0);

  // Load templates from DB
  useEffect(() => {
    if (!activeAccount?.ad_account_id) return;
    supabase
      .from('meta_ad_creatives')
      .select('ad_id, ad_name, campaign_name, adset_name, destination_url, image_url, thumbnail_url')
      .eq('account_id', activeAccount.ad_account_id)
      .not('destination_url', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(100)
      .then(({ data }) => setTemplates((data as TemplateAd[]) ?? []));
  }, [activeAccount?.ad_account_id]);

  // Auto-set optimization goal when objective changes
  useEffect(() => {
    const goals = OPTIMIZATION_GOALS[objective];
    if (goals?.length) setOptimizationGoal(goals[0].value);
  }, [objective]);

  // Apply template
  async function applyTemplate(adId: string) {
    const t = templates.find(t => t.ad_id === adId);
    if (!t) return;
    setSelectedTemplate(adId);
    if (t.campaign_name) setCampaignName(`Cópia — ${t.campaign_name}`);
    if (t.adset_name) setAdsetName(t.adset_name);
    if (t.ad_name) setAdName(t.ad_name);
    if (t.destination_url) setDestinationUrl(t.destination_url);
    if (t.image_url) setImageUrl(t.image_url);

    if (!activeAccount?.ad_account_id) return;
    setFetchingTemplate(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-fetch-ad-template`, {
        method: 'POST',
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad_id: adId, account_id: activeAccount.ad_account_id }),
      });
      const data = await res.json();
      if (data.ok) {
        if (data.page_id) setPageId(data.page_id);
        if (data.image_hash) setImageHash(data.image_hash);
        if (data.targeting) {
          const tg = data.targeting;
          if (tg.countries?.[0]) setCountry(tg.countries[0]);
          if (tg.age_min) setAgeMin(String(tg.age_min));
          if (tg.age_max) setAgeMax(String(tg.age_max));
          setGender(tg.genders?.length === 1 ? String(tg.genders[0]) : '0');
          if (tg.optimization_goal) setOptimizationGoal(tg.optimization_goal);
          if (tg.daily_budget) setAdsetBudget(String(tg.daily_budget));
          if (tg.adset_name) setAdsetName(tg.adset_name);
          if (tg.promoted_object) setPromotedObject(tg.promoted_object);
        }
      }
    } catch {
      // silently ignore — fields stay as entered
    } finally {
      setFetchingTemplate(false);
    }
  }

  // Media file handlers
  function addFiles(files: FileList | File[]) {
    const newItems: MediaItem[] = Array.from(files).map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setMediaItems(prev => [...prev, ...newItems]);
  }

  function removeMedia(index: number) {
    setMediaItems(prev => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }, []);

  function toggleSection(key: string) {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSubmit() {
    if (!activeAccount?.ad_account_id) return;
    if (!campaignName || !adsetName || !destinationUrl) {
      setResult({ ok: false, msg: 'Preencha todos os campos obrigatórios.' });
      return;
    }
    if (!mediaItems.length && !adName) {
      setResult({ ok: false, msg: 'Informe o nome do anúncio ou selecione arquivos de mídia.' });
      return;
    }

    setSubmitting(true);
    setResult(null);

    try {
      const jsonData = {
        account_id: activeAccount.ad_account_id,
        campaign: {
          name: campaignName,
          objective,
          status: campaignStatus,
          ...(isCBO ? { daily_budget: parseFloat(campaignBudget) } : {}),
        },
        adset: {
          name: adsetName,
          optimization_goal: optimizationGoal,
          ...(!isCBO ? { daily_budget: parseFloat(adsetBudget || '50') } : {}),
          ...(promotedObject ? { promoted_object: promotedObject } : {}),
          countries: [country],
          age_min: parseInt(ageMin),
          age_max: parseInt(ageMax),
          genders: gender === '0' ? [] : [parseInt(gender)],
          status: campaignStatus,
        },
        creative: {
          page_id: pageId,
          image_hash: mediaItems.length === 0 && imageHash ? imageHash : undefined,
          image_url: mediaItems.length === 0 && imageUrl && !imageHash ? imageUrl : undefined,
          message: primaryText,
          headline,
          description,
          link: destinationUrl,
          cta_type: ctaType,
        },
        ad: { name: adName, status: campaignStatus },
      };

      let res: Response;
      if (mediaItems.length > 0) {
        const formData = new FormData();
        formData.append('data', JSON.stringify(jsonData));
        mediaItems.forEach((item, i) => formData.append(`media_${i}`, item.file));
        res = await fetch(`${SUPABASE_URL}/functions/v1/meta-create-campaign`, {
          method: 'POST',
          headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
          body: formData,
        });
      } else {
        res = await fetch(`${SUPABASE_URL}/functions/v1/meta-create-campaign`, {
          method: 'POST',
          headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(jsonData),
        });
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const count = data.ads?.length ?? 1;
      setResult({
        ok: true,
        msg: `Campanha criada com sucesso! ${count} anúncio${count > 1 ? 's' : ''} criado${count > 1 ? 's' : ''}.`,
        campaign_id: data.campaign_id,
        adset_id: data.adset_id,
        ads: data.ads,
      });
    } catch (e: any) {
      setResult({ ok: false, msg: e.message });
    } finally {
      setSubmitting(false);
    }
  }

  const currentGoals = OPTIMIZATION_GOALS[objective] ?? [];
  const selectedTemplateObj = templates.find(t => t.ad_id === selectedTemplate);

  return (
    <div className="min-h-screen bg-background p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Nova Campanha</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeAccount ? activeAccount.name : 'Selecione uma conta'}
          </p>
        </div>
        {campaignStatus === 'PAUSED'
          ? <Badge variant="secondary">Criada como Pausada</Badge>
          : <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Criada como Ativa</Badge>
        }
      </div>

      {/* Template selector */}
      {templates.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Usar anúncio existente como base (opcional)
            </p>
            <Select
              value={selectedTemplate || '__none__'}
              onValueChange={v => v === '__none__' ? setSelectedTemplate('') : applyTemplate(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecionar anúncio existente..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Criar do zero</SelectItem>
                {templates.map(t => (
                  <SelectItem key={t.ad_id} value={t.ad_id}>
                    <span className="font-medium">{t.campaign_name}</span>
                    <span className="text-muted-foreground ml-2 text-xs">— {t.ad_name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <div className="mt-2 flex items-center gap-2">
                {(selectedTemplateObj?.thumbnail_url || selectedTemplateObj?.image_url) && (
                  <img
                    src={selectedTemplateObj.thumbnail_url || selectedTemplateObj.image_url!}
                    className="w-12 h-12 rounded object-cover border border-border"
                    alt="preview"
                  />
                )}
                {fetchingTemplate
                  ? <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" />Carregando públicos e página...
                    </span>
                  : <p className="text-xs text-muted-foreground">Campos preenchidos a partir deste anúncio. Edite conforme necessário.</p>
                }
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Campaign Section ── */}
      <Card>
        <CardHeader className="pb-3 cursor-pointer select-none" onClick={() => toggleSection('campaign')}>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2"><Megaphone className="w-4 h-4 text-primary" />Campanha</span>
            {sections.campaign ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        {sections.campaign && (
          <CardContent className="space-y-4 pt-0">
            <Field label="Nome da campanha *">
              <input value={campaignName} onChange={e => setCampaignName(e.target.value)}
                placeholder="Ex: PERP | NB | Produto | Frio | ABO"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </Field>

            <Field label="Objetivo *">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {OBJECTIVES.map(obj => (
                  <button key={obj.value} type="button" onClick={() => setObjective(obj.value)}
                    className={`text-left p-3 rounded-lg border transition-all ${objective === obj.value ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'}`}>
                    <p className="text-sm font-medium">{obj.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{obj.desc}</p>
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Status inicial">
                <Select value={campaignStatus} onValueChange={setCampaignStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PAUSED">Pausado</SelectItem>
                    <SelectItem value="ACTIVE">Ativo</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Budget da campanha — CBO (R$)">
                <input value={campaignBudget} onChange={e => setCampaignBudget(e.target.value)}
                  placeholder="Vazio = budget no conjunto (ABO)"
                  type="number" min="1"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </Field>
            </div>
            {isCBO && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                Modo CBO ativo — o budget será definido na campanha. O budget do conjunto será ignorado.
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {/* ── Ad Set Section ── */}
      <Card>
        <CardHeader className="pb-3 cursor-pointer select-none" onClick={() => toggleSection('adset')}>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2"><Users className="w-4 h-4 text-primary" />Conjunto de Anúncios</span>
            {sections.adset ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        {sections.adset && (
          <CardContent className="space-y-4 pt-0">
            <Field label="Nome do conjunto *">
              <input value={adsetName} onChange={e => setAdsetName(e.target.value)}
                placeholder="Ex: BR | 18-45 | Interesses | Feed"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Meta de otimização *">
                <Select value={optimizationGoal} onValueChange={setOptimizationGoal}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {currentGoals.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={isCBO ? 'Budget do conjunto (desativado no CBO)' : 'Budget diário (R$) *'}>
                <input value={adsetBudget} onChange={e => setAdsetBudget(e.target.value)}
                  type="number" min="1" disabled={isCBO}
                  className={cn(
                    'w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
                    isCBO && 'opacity-40 cursor-not-allowed'
                  )} />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Field label="País">
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Idade mín.">
                <input value={ageMin} onChange={e => setAgeMin(e.target.value)} type="number" min="13" max="65"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </Field>
              <Field label="Idade máx.">
                <input value={ageMax} onChange={e => setAgeMax(e.target.value)} type="number" min="13" max="65"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </Field>
            </div>

            <Field label="Gênero">
              <div className="flex gap-2">
                {[['0','Todos'],['1','Masculino'],['2','Feminino']].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setGender(v)}
                    className={`flex-1 py-2 rounded-md border text-sm font-medium transition-all ${gender === v ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground hover:border-muted-foreground'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </Field>
          </CardContent>
        )}
      </Card>

      {/* ── Creative Section ── */}
      <Card>
        <CardHeader className="pb-3 cursor-pointer select-none" onClick={() => toggleSection('creative')}>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-primary" />Anúncio
              {mediaItems.length > 1 && (
                <Badge variant="secondary" className="text-xs ml-1">{mediaItems.length} anúncios</Badge>
              )}
            </span>
            {sections.creative ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        {sections.creative && (
          <CardContent className="space-y-4 pt-0">
            {/* Ad name — only shown when no media files (names come from filenames otherwise) */}
            {mediaItems.length === 0 ? (
              <Field label="Nome do anúncio *">
                <input value={adName} onChange={e => setAdName(e.target.value)}
                  placeholder="Ex: AD01 | Imagem | Texto A"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </Field>
            ) : (
              <p className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded-md border border-border">
                Nome dos anúncios gerado automaticamente a partir dos nomes dos arquivos.
              </p>
            )}

            {/* Media picker */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Mídia {mediaItems.length > 1 && <span className="normal-case">— {mediaItems.length} arquivo{mediaItems.length > 1 ? 's' : ''} = {mediaItems.length} anúncio{mediaItems.length > 1 ? 's' : ''}</span>}
              </label>

              {/* File list */}
              {mediaItems.length > 0 && (
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-0.5">
                  {mediaItems.map((item, i) => {
                    const isVideo = item.file.type.startsWith('video/');
                    return (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/50">
                        <div className="w-9 h-9 rounded overflow-hidden border border-border bg-background flex items-center justify-center shrink-0">
                          {isVideo
                            ? <Film size={14} className="text-muted-foreground" />
                            : <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <span className="text-xs truncate flex-1 text-muted-foreground">{item.file.name}</span>
                        <button onClick={() => removeMedia(i)} className="shrink-0 text-muted-foreground hover:text-foreground">
                          <X size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Drop zone */}
              <div
                role="button" tabIndex={0}
                className={cn(
                  'border-2 border-dashed rounded-md p-4 flex flex-col items-center gap-1.5 cursor-pointer transition-colors',
                  isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'
                )}
                onClick={() => inputRef.current?.click()}
                onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <Upload size={18} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">
                  {mediaItems.length === 0
                    ? <><span className="text-foreground font-medium">Clique ou arraste</span> para selecionar mídias</>
                    : <span className="text-foreground font-medium">Adicionar mais arquivos</span>
                  }
                </p>
                <p className="text-xs text-muted-foreground">
                  {mediaItems.length === 0 ? '1 arquivo = 1 anúncio · vários arquivos = vários anúncios' : 'Imagens ou vídeos'}
                </p>
              </div>
              <input
                ref={inputRef} type="file" accept="image/*,video/*" multiple className="sr-only"
                onChange={e => { if (e.target.files?.length) { addFiles(e.target.files); e.target.value = ''; } }}
              />
            </div>

            {/* URL field — only shown when no files selected */}
            {mediaItems.length === 0 && (
              <Field label="URL da imagem (alternativa ao upload)">
                <div className="flex gap-2">
                  <input value={imageUrl} onChange={e => setImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  {imageUrl && (
                    <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="flex items-center px-2 text-muted-foreground hover:text-foreground">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                {imageUrl && (
                  <img src={imageUrl} alt="preview" className="mt-2 h-32 rounded-lg object-cover border border-border"
                    onError={e => (e.currentTarget.style.display = 'none')} />
                )}
              </Field>
            )}

            <Field label="Texto principal">
              <textarea value={primaryText} onChange={e => setPrimaryText(e.target.value)}
                placeholder="Texto do anúncio que aparece acima da imagem..."
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Título">
                <input value={headline} onChange={e => setHeadline(e.target.value)}
                  placeholder="Título em destaque"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </Field>
              <Field label="Descrição">
                <input value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Texto abaixo do título"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </Field>
            </div>

            <Field label="URL de destino *">
              <input value={destinationUrl} onChange={e => setDestinationUrl(e.target.value)}
                placeholder="https://seusite.com/pagina"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </Field>

            <Field label="Botão CTA">
              <Select value={ctaType} onValueChange={setCtaType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CTA_TYPES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </CardContent>
        )}
      </Card>

      {/* Result */}
      {result && (
        <div className={`flex items-start gap-2 p-4 rounded-lg border text-sm ${result.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {result.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="font-medium">{result.msg}</p>
            {result.ok && (
              <div className="mt-2 space-y-1 font-mono text-xs opacity-80">
                <p>Campanha: {result.campaign_id}</p>
                <p>Conjunto: {result.adset_id}</p>
                {result.ads && result.ads.length === 1 && (
                  <p>Anúncio: {result.ads[0].ad_id}</p>
                )}
                {result.ads && result.ads.length > 1 && (
                  <div className="mt-1 space-y-0.5">
                    {result.ads.map((a, i) => (
                      <p key={a.ad_id}>{i + 1}. {a.name} → {a.ad_id}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Submit */}
      <div className="flex gap-3 pb-8">
        <Button onClick={handleSubmit} disabled={submitting || !activeAccount} size="lg" className="flex-1">
          {submitting
            ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Criando...</>
            : mediaItems.length > 1
              ? `Criar campanha com ${mediaItems.length} anúncios`
              : 'Criar Campanha'
          }
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
