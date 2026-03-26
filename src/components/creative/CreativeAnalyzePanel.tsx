import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trophy, ThumbsUp, AlertTriangle, XCircle, GraduationCap, Pause, Copy, Lightbulb, Layers, Wand2, Loader2, Maximize2, Rocket, CheckCircle2 } from 'lucide-react';
import type { AdCreative } from '@/hooks/useCreativeIntelligence';
import CreativePreview from '@/components/creative/CreativePreview';
import CreativeScoreChart from '@/components/creative/CreativeScoreChart';
import { supabase } from '@/integrations/supabase/client';

const STATUS_MAP: Record<string, { icon: React.ComponentType<any>; color: string; bg: string }> = {
  Winner: { icon: Trophy, color: 'text-emerald-700', bg: 'bg-emerald-50' },
  Good: { icon: ThumbsUp, color: 'text-blue-700', bg: 'bg-blue-50' },
  Risk: { icon: AlertTriangle, color: 'text-amber-700', bg: 'bg-amber-50' },
  Bad: { icon: XCircle, color: 'text-red-700', bg: 'bg-red-50' },
  Learning: { icon: GraduationCap, color: 'text-muted-foreground', bg: 'bg-muted' },
};

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function pct(v: number) { return `${v.toFixed(2)}%`; }

function getSuggestedActions(ad: AdCreative) {
  switch (ad.status) {
    case 'Winner': return [
      { icon: Copy, label: 'Duplicar Winner', description: 'Crie variações deste criativo para escalar resultados' },
      { icon: Layers, label: 'Criar Variação', description: 'Teste novos hooks mantendo a estrutura que funciona' },
    ];
    case 'Good': return [
      { icon: Lightbulb, label: 'Testar Novo Hook', description: 'Mantenha a oferta e teste diferentes aberturas' },
      { icon: Layers, label: 'Criar Variação', description: 'Pequenos ajustes podem elevar para Winner' },
    ];
    case 'Risk': return [
      { icon: Lightbulb, label: 'Testar Novo Hook', description: 'A abertura pode estar saturada' },
      { icon: Pause, label: 'Monitorar de Perto', description: 'Acompanhe nas próximas 48h antes de pausar' },
    ];
    case 'Bad': return [
      { icon: Pause, label: 'Pausar Criativo', description: 'Pare de gastar verba neste criativo' },
      { icon: Layers, label: 'Criar Variação', description: 'Refaça com nova abordagem criativa' },
    ];
    default: return [{ icon: Lightbulb, label: 'Aguardar Dados', description: 'Deixe rodar até atingir o mínimo de dados' }];
  }
}

interface LaunchResult { newAdId: string; newAdName: string; adsetId: string; status: string; }

export default function CreativeAnalyzePanel({ ad, onClose }: { ad: AdCreative; onClose: () => void }) {
  const statusConfig = STATUS_MAP[ad.status] || STATUS_MAP.Learning;
  const StatusIcon = statusConfig.icon;
  const actions = getSuggestedActions(ad);

  const [generating, setGenerating] = useState(false);
  const [variationResult, setVariationResult] = useState<{ imageUrl: string; explanation: string } | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null);

  const hasImage = !!(ad.image_url || ad.media_best_url || ad.thumbnail_url);
  const isVideo = ad.creative_type === 'video';
  const canGenerate = hasImage && !isVideo;
  const originalImageUrl = ad.image_url || ad.media_best_url || ad.thumbnail_url;

  const handleGenerateVariation = async () => {
    if (!originalImageUrl) return;
    setGenerating(true);
    setVariationResult(null);
    setLaunchResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('creative-generate-variation', {
        body: { imageUrl: originalImageUrl, adName: ad.ad_name, status: ad.status, reasons: ad.reasons, score: ad.score, creativeType: ad.creative_type },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.generatedImageUrl) setVariationResult({ imageUrl: data.generatedImageUrl, explanation: data.explanation || 'Variação gerada.' });
    } catch (e: any) { console.error(e); }
    finally { setGenerating(false); }
  };

  const handleLaunchVariation = async () => {
    if (!variationResult?.imageUrl) return;
    setLaunching(true);
    try {
      const { data, error } = await supabase.functions.invoke('creative-launch-variation', {
        body: { adId: ad.ad_id, adsetId: ad.adset_id, adName: ad.ad_name, generatedImageUrl: variationResult.imageUrl },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLaunchResult({ newAdId: data.newAdId, newAdName: data.newAdName, adsetId: data.adsetId, status: data.status });
    } catch (e: any) { console.error(e); }
    finally { setLaunching(false); }
  };

  return (
    <Sheet open onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle className="text-left">Análise de Performance</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-4">
          <CreativePreview
            adPreviewHtml={ad.ad_preview_html || ad.preview_html}
            imageUrl={ad.image_url} thumbnailUrl={ad.thumbnail_url}
            mediaBestUrl={ad.media_best_url} videoThumbnailUrl={ad.video_thumbnail_url}
            videoSource={ad.video_source} creativeType={ad.creative_type}
            adName={ad.ad_name} className="aspect-video" mode="modal"
          />
          <div>
            <h3 className="font-semibold text-foreground">{ad.ad_name}</h3>
            <p className="text-sm text-muted-foreground">{ad.campaign_name} → {ad.adset_name}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${statusConfig.bg} ${statusConfig.color} font-semibold text-sm`}>
              <StatusIcon className="w-4 h-4" />{ad.status}
            </div>
            <span className="text-sm text-muted-foreground">Score: {ad.score}/100</span>
          </div>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Métricas</CardTitle>
                {ad.conversion_mode && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                    ad.conversion_mode === 'purchase' ? 'text-purple-700 bg-purple-50 border-purple-200' :
                    ad.conversion_mode === 'lead' ? 'text-sky-700 bg-sky-50 border-sky-200' :
                    'text-slate-600 bg-slate-50 border-slate-200'
                  }`}>
                    {ad.conversion_mode === 'purchase' ? 'Venda' : ad.conversion_mode === 'lead' ? 'Lead' : 'Tráfego'}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              {([
                ['Impressões', ad.impressions.toLocaleString('pt-BR')],
                ['Frequência', ad.frequency.toFixed(1)],
                ['Spend', fmt(ad.spend)],
                ['CTR (all)', pct(ad.ctr)],
                ['Link CTR', ad.link_ctr > 0 ? pct(ad.link_ctr) : '—'],
                ['LP CVR', ad.lp_cvr > 0 ? pct(ad.lp_cvr) : '—'],
                ['CPC', fmt(ad.cpc)],
                ['CPM', fmt(ad.cpm)],
                ...(ad.conversion_mode === 'purchase' ? [
                  ['CPA', ad.cpa > 0 ? fmt(ad.cpa) : '—'] as [string, string],
                  ['ROAS', ad.score_roas != null && ad.score_roas > 0 ? `${ad.score_roas.toFixed(2)}x` : '—'] as [string, string],
                ] : ad.conversion_mode === 'lead' ? [
                  ['CPL', ad.cpl > 0 ? fmt(ad.cpl) : '—'] as [string, string],
                  ['Leads', ad.leads > 0 ? String(ad.leads) : '—'] as [string, string],
                ] : []),
                ...(ad.creative_type === 'video' ? [
                  ['Hook Rate', ad.hook_rate > 0 ? pct(ad.hook_rate) : '—'] as [string, string],
                  ['ThruPlay', ad.video_thruplay > 0 ? ad.video_thruplay.toLocaleString('pt-BR') : '—'] as [string, string],
                ] : []),
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Por que {ad.status}?</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {(ad.reasons || []).map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusConfig.color.replace('text-', 'bg-')}`} />
                    {r}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <CreativeScoreChart adId={ad.ad_id} adsetId={ad.adset_id} currentScore={ad.score} currentStatus={ad.status} />
          {canGenerate && (
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Wand2 className="w-4 h-4 text-primary" />Gerar Variação com IA</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">A IA analisa o criativo original e gera uma variação visual otimizada.</p>
                {!variationResult && (
                  <Button onClick={handleGenerateVariation} disabled={generating} className="w-full" size="sm">
                    {generating ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Gerando...</> : <><Wand2 className="w-4 h-4 mr-2" />Gerar Variação Visual</>}
                  </Button>
                )}
                {variationResult && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">Original</p>
                        <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                          <img src={originalImageUrl!} alt="Original" className="w-full h-full object-cover" />
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-primary mb-1 uppercase tracking-wider">Variação IA</p>
                        <div className="aspect-square bg-muted rounded-lg overflow-hidden border border-primary/30">
                          <img src={variationResult.imageUrl} alt="Variação" className="w-full h-full object-cover" />
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setCompareOpen(true)}>
                      <Maximize2 className="w-4 h-4 mr-2" />Ver Comparação
                    </Button>
                    <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
                      <DialogContent className="max-w-4xl w-[95vw]">
                        <DialogHeader><DialogTitle>Original vs Variação IA</DialogTitle></DialogHeader>
                        <div className="grid grid-cols-2 gap-4">
                          <div><p className="text-xs font-medium text-muted-foreground mb-2 uppercase">Original</p>
                            <img src={originalImageUrl!} alt="Original" className="w-full h-auto rounded-lg" /></div>
                          <div><p className="text-xs font-medium text-primary mb-2 uppercase">Variação IA</p>
                            <img src={variationResult.imageUrl} alt="Variação" className="w-full h-auto rounded-lg border border-primary/30" /></div>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50 border"><p className="text-sm">{variationResult.explanation}</p></div>
                      </DialogContent>
                    </Dialog>
                    <div className="p-2.5 rounded-lg bg-muted/50 border"><p className="text-xs leading-relaxed">{variationResult.explanation}</p></div>
                    {!launchResult && (
                      <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleLaunchVariation} disabled={launching}>
                        {launching ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />Criando...</> : <><Rocket className="w-4 h-4 mr-1" />Lançar no Meta</>}
                      </Button>
                    )}
                    {launchResult && (
                      <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 space-y-2">
                        <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
                          <CheckCircle2 className="w-4 h-4" />Anúncio criado com sucesso!
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between"><span className="text-muted-foreground">Nome</span><span className="font-medium">{launchResult.newAdName}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant="secondary" className="text-[10px] px-1.5 py-0">PAUSED</Badge></div>
                        </div>
                      </div>
                    )}
                    <Button variant="outline" size="sm" className="w-full" onClick={handleGenerateVariation} disabled={generating}>
                      <Wand2 className="w-4 h-4 mr-2" />Gerar Nova Variação
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Ações Sugeridas</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {actions.map((action, i) => (
                <button key={i} className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <action.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
