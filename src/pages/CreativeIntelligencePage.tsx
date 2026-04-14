import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw, Loader2, Trophy, ThumbsUp, AlertTriangle, XCircle, GraduationCap, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useCreativeIntelligence } from '@/hooks/useCreativeIntelligence';
import type { AdCreative } from '@/hooks/useCreativeIntelligence';
import CreativeAnalyzePanel from '@/components/creative/CreativeAnalyzePanel';
import CreativePreview from '@/components/creative/CreativePreview';

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ComponentType<any> }> = {
  Winner: { label: 'Winner', color: 'text-emerald-400', bgColor: 'bg-emerald-950/60 border-emerald-700/40', icon: Trophy },
  Good: { label: 'Good', color: 'text-blue-400', bgColor: 'bg-blue-950/60 border-blue-700/40', icon: ThumbsUp },
  Risk: { label: 'Risk', color: 'text-amber-400', bgColor: 'bg-amber-950/60 border-amber-700/40', icon: AlertTriangle },
  Bad: { label: 'Bad', color: 'text-red-400', bgColor: 'bg-red-950/60 border-red-700/40', icon: XCircle },
  Learning: { label: 'Learning', color: 'text-muted-foreground', bgColor: 'bg-muted border-border', icon: GraduationCap },
};

function formatCurrency(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatPercent(v: number) { return `${v.toFixed(2)}%`; }

export default function CreativeIntelligencePage() {
  const {
    ads, summary, campaigns, adsets, loading, error,
    selectedCampaign, setSelectedCampaign, selectedAdset, setSelectedAdset,
    selectedStatus, setSelectedStatus, datePreset, setDatePreset, reload,
  } = useCreativeIntelligence();

  const [analyzeAd, setAnalyzeAd] = useState<AdCreative | null>(null);
  const [viewAd, setViewAd] = useState<AdCreative | null>(null);
  const [search, setSearch] = useState('');

  const summaryCards = [
    { key: 'Winner', icon: Trophy, count: summary.Winner, color: 'text-emerald-400', bg: 'bg-emerald-950/40' },
    { key: 'Good', icon: ThumbsUp, count: summary.Good, color: 'text-blue-400', bg: 'bg-blue-950/40' },
    { key: 'Risk', icon: AlertTriangle, count: summary.Risk, color: 'text-amber-400', bg: 'bg-amber-950/40' },
    { key: 'Bad', icon: XCircle, count: summary.Bad, color: 'text-red-400', bg: 'bg-red-950/40' },
    { key: 'Learning', icon: GraduationCap, count: summary.Learning, color: 'text-muted-foreground', bg: 'bg-muted' },
  ];

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Creative Intelligence</h1>
          <p className="text-muted-foreground mt-1">Análise de performance de criativos por ad</p>
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {summaryCards.map((c) => (
          <Card key={c.key} className={`cursor-pointer transition-all hover:shadow-md ${selectedStatus === c.key ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setSelectedStatus(selectedStatus === c.key ? '' : c.key)}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center`}>
                <c.icon className={`w-5 h-5 ${c.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{c.count}</p>
                <p className="text-xs text-muted-foreground">{c.key}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filtrar por nome..."
            className="h-9 w-52 rounded-md border border-input bg-background text-sm pl-8 pr-7 focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Select value={datePreset} onValueChange={(v: any) => setDatePreset(v)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="yesterday">Ontem</SelectItem>
            <SelectItem value="last_7d">Últimos 7 dias</SelectItem>
            <SelectItem value="last_30d">Últimos 30 dias</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedCampaign || '__all__'} onValueChange={v => setSelectedCampaign(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todas as campanhas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as campanhas</SelectItem>
            {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedAdset || '__all__'} onValueChange={v => setSelectedAdset(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todos os adsets" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os adsets</SelectItem>
            {adsets.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedStatus || '__all__'} onValueChange={v => setSelectedStatus(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Todos os status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os status</SelectItem>
            {Object.keys(STATUS_CONFIG).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/50 text-red-400 border border-red-800/40 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
        </div>
      ) : ads.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          Nenhum criativo encontrado. Clique em "Sync Meta Data" para sincronizar.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {ads
            .filter(ad => !search.trim() || ad.ad_name.toLowerCase().includes(search.trim().toLowerCase()))
            .map(ad => (
              <CreativeCard key={`${ad.ad_id}_${ad.adset_id}`} ad={ad}
                onAnalyze={() => setAnalyzeAd(ad)} onView={() => setViewAd(ad)} />
            ))}
        </div>
      )}

      {analyzeAd && <CreativeAnalyzePanel ad={analyzeAd} onClose={() => setAnalyzeAd(null)} />}
      <Dialog open={!!viewAd} onOpenChange={() => setViewAd(null)}>
        <DialogContent className="max-w-[900px] p-0 overflow-hidden" aria-describedby={undefined}>
          <DialogTitle className="sr-only">{viewAd?.ad_name ?? 'Preview'}</DialogTitle>
          {viewAd && (
            <div>
              <CreativePreview
                adPreviewHtml={viewAd.ad_preview_html || viewAd.preview_html}
                imageUrl={viewAd.image_url} thumbnailUrl={viewAd.thumbnail_url}
                mediaBestUrl={viewAd.media_best_url} videoThumbnailUrl={viewAd.video_thumbnail_url}
                videoSource={viewAd.video_source} creativeType={viewAd.creative_type}
                adName={viewAd.ad_name} className="w-full min-h-[400px]" mode="modal"
              />
              <div className="p-4">
                <p className="font-semibold">{viewAd.ad_name}</p>
                <p className="text-sm text-muted-foreground">{viewAd.campaign_name} → {viewAd.adset_name}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const MODE_CONFIG: Record<string, { label: string; color: string }> = {
  purchase: { label: 'Venda', color: 'text-purple-700 bg-purple-50 border-purple-200' },
  lead: { label: 'Lead', color: 'text-sky-700 bg-sky-50 border-sky-200' },
  traffic: { label: 'Tráfego', color: 'text-slate-600 bg-slate-50 border-slate-200' },
};

function getMetricRows(ad: AdCreative): [string, string][] {
  const mode = ad.conversion_mode;
  const rows: [string, string][] = [];
  if (mode === 'purchase') {
    rows.push(['CPA', ad.cpa > 0 ? formatCurrency(ad.cpa) : '—']);
    rows.push(['ROAS', ad.score_roas != null && ad.score_roas > 0 ? `${ad.score_roas.toFixed(2)}x` : '—']);
  } else if (mode === 'lead') {
    rows.push(['CPL', ad.cpl > 0 ? formatCurrency(ad.cpl) : '—']);
    rows.push(['Leads', ad.leads > 0 ? String(ad.leads) : '—']);
  } else {
    rows.push(['CPC', formatCurrency(ad.cpc)]);
    rows.push(['CPM', formatCurrency(ad.cpm)]);
  }
  rows.push(['Link CTR', ad.link_ctr > 0 ? formatPercent(ad.link_ctr) : '—']);
  rows.push(['LP CVR', ad.lp_cvr > 0 ? formatPercent(ad.lp_cvr) : '—']);
  if (ad.creative_type === 'video' && ad.hook_rate > 0) {
    rows.push(['Hook Rate', formatPercent(ad.hook_rate)]);
  } else {
    rows.push(['Freq', ad.frequency.toFixed(1)]);
  }
  rows.push(['Spend', formatCurrency(ad.spend)]);
  return rows;
}

function CreativeCard({ ad, onAnalyze, onView }: { ad: AdCreative; onAnalyze: () => void; onView: () => void }) {
  const config = STATUS_CONFIG[ad.status] || STATUS_CONFIG.Learning;
  const StatusIcon = config.icon;
  const modeConf = ad.conversion_mode ? MODE_CONFIG[ad.conversion_mode] : null;
  const metricRows = getMetricRows(ad);
  const isVideo = ad.creative_type === 'video';

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative cursor-pointer" onClick={onView}>
        <CreativePreview imageUrl={ad.image_url} thumbnailUrl={ad.thumbnail_url}
          mediaBestUrl={ad.media_best_url} videoThumbnailUrl={ad.video_thumbnail_url}
          creativeType={ad.creative_type} adName={ad.ad_name} className="aspect-video" mode="card" />
        <Badge className={`absolute top-2 right-2 ${config.bgColor} ${config.color} border text-[11px] font-semibold`}>
          <StatusIcon className="w-3 h-3 mr-1" />{config.label}
        </Badge>
        <div className="absolute top-2 left-2 flex items-center gap-1">
          <span className="bg-background/80 backdrop-blur-sm text-foreground text-[11px] font-bold px-2 py-0.5 rounded">
            {ad.score}/100
          </span>
          {isVideo && ad.hook_rate > 0 && (
            <span className="bg-violet-600/90 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
              Hook {formatPercent(ad.hook_rate)}
            </span>
          )}
        </div>
      </div>
      <CardContent className="p-3 space-y-2">
        <div>
          <div className="flex items-start justify-between gap-1">
            <p className="font-medium text-sm truncate flex-1" title={ad.ad_name}>{ad.ad_name}</p>
            {modeConf && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${modeConf.color}`}>
                {modeConf.label}
              </span>
            )}
          </div>
          <p className="text-xs text-primary/80 truncate"><span className="font-medium">Adset:</span> {ad.adset_name}</p>
          <p className="text-xs text-muted-foreground truncate">{ad.campaign_name}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {metricRows.map(([l, v]) => (
            <div key={l} className="flex justify-between">
              <span className="text-muted-foreground">{l}</span>
              <span className="font-medium">{v}</span>
            </div>
          ))}
        </div>
        {ad.reasons && ad.reasons.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {ad.reasons.slice(0, 2).map((r, i) => (
              <span key={i} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full truncate max-w-full">
                {r}
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" className="flex-1 text-xs h-7" onClick={onView}>Ver</Button>
          <Button variant="outline" size="sm" className="flex-1 text-xs h-7" onClick={onAnalyze}>Analisar</Button>
          {/* Duplicar movido para tela Campanhas */}
        </div>
      </CardContent>
    </Card>
  );
}
