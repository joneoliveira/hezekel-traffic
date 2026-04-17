import { useState } from 'react';
import { useContentIntelligence, type ContentIntelligenceAd } from '@/hooks/useContentIntelligence';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertCircle, RefreshCw, Loader2, Trophy, ThumbsUp,
  AlertTriangle, XCircle, GraduationCap, Calendar, Search, X, Play, Lock, Unlock,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ComponentType<any> }> = {
  Winner: { label: 'Winner', color: 'text-emerald-400', bgColor: 'bg-emerald-950/60 border-emerald-700/40', icon: Trophy },
  Good:   { label: 'Good',   color: 'text-blue-400',    bgColor: 'bg-blue-950/60 border-blue-700/40',       icon: ThumbsUp },
  Risk:   { label: 'Risk',   color: 'text-amber-400',   bgColor: 'bg-amber-950/60 border-amber-700/40',     icon: AlertTriangle },
  Bad:    { label: 'Bad',    color: 'text-red-400',     bgColor: 'bg-red-950/60 border-red-700/40',         icon: XCircle },
  Learning: { label: 'Learning', color: 'text-muted-foreground', bgColor: 'bg-muted border-border',         icon: GraduationCap },
};

const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmtCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtN = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

export default function ContentIntelligencePage() {
  const {
    ads, summary, loading, error,
    since, setSince, until, setUntil,
    selectedStatus, setSelectedStatus,
    search, setSearch,
    campaignFilter, saveCampaignFilter,
    reload,
  } = useContentIntelligence();

  const [filterInput, setFilterInput] = useState(campaignFilter);

  const summaryCards = [
    { key: 'Winner',   icon: Trophy,         count: summary.Winner,   color: 'text-emerald-400', bg: 'bg-emerald-950/40' },
    { key: 'Good',     icon: ThumbsUp,       count: summary.Good,     color: 'text-blue-400',    bg: 'bg-blue-950/40' },
    { key: 'Risk',     icon: AlertTriangle,  count: summary.Risk,     color: 'text-amber-400',   bg: 'bg-amber-950/40' },
    { key: 'Bad',      icon: XCircle,        count: summary.Bad,      color: 'text-red-400',     bg: 'bg-red-950/40' },
    { key: 'Learning', icon: GraduationCap,  count: summary.Learning, color: 'text-muted-foreground', bg: 'bg-muted' },
  ];

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Content Intelligence</h1>
          <p className="text-muted-foreground mt-1">
            Análise de conteúdo
            {campaignFilter && (
              <> · filtro: <span className="text-amber-500 font-mono">{campaignFilter}</span> <Lock className="w-3 h-3 inline text-amber-500" /></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-card border border-border rounded-md px-3 h-9">
            <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <input type="date" value={since} onChange={e => setSince(e.target.value)}
              className="bg-transparent text-white text-xs focus:outline-none" />
            <span className="text-muted-foreground text-xs">→</span>
            <input type="date" value={until} onChange={e => setUntil(e.target.value)}
              className="bg-transparent text-white text-xs focus:outline-none" />
          </div>
          <Button variant="outline" size="sm" onClick={reload} disabled={loading} className="h-9">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {summaryCards.map(c => (
          <Card key={c.key}
            className={`cursor-pointer transition-all hover:shadow-md ${selectedStatus === c.key ? 'ring-2 ring-primary' : ''}`}
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

      {/* Filters */}
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
        <Select value={selectedStatus || '__all__'} onValueChange={v => setSelectedStatus(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Todos os status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os status</SelectItem>
            {Object.keys(STATUS_CONFIG).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Campaign filter — persisted */}
        <form
          onSubmit={e => { e.preventDefault(); saveCampaignFilter(filterInput); }}
          className="flex items-center gap-1.5"
        >
          <div className="relative">
            {campaignFilter && filterInput === campaignFilter
              ? <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-500 pointer-events-none" />
              : <Unlock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            }
            <input
              value={filterInput}
              onChange={e => setFilterInput(e.target.value)}
              placeholder="Filtrar campanha..."
              className="h-9 w-44 rounded-md border border-input bg-background text-sm text-foreground pl-8 pr-2 focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>
          {filterInput !== campaignFilter && (
            <Button type="submit" size="sm" variant="outline" className="h-9 text-xs gap-1">
              <Lock className="w-3 h-3" />Salvar
            </Button>
          )}
          {campaignFilter && filterInput === campaignFilter && (
            <button
              type="button"
              onClick={() => { setFilterInput(''); saveCampaignFilter(''); }}
              className="text-muted-foreground hover:text-foreground"
              title="Remover filtro"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/50 text-red-400 border border-red-800/40 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
        </div>
      ) : ads.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          Nenhum conteúdo encontrado para o período selecionado.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {ads.map(ad => <ContentCard key={ad.ad_id} ad={ad} />)}
        </div>
      )}
    </div>
  );
}

function ContentCard({ ad }: { ad: ContentIntelligenceAd }) {
  const config = STATUS_CONFIG[ad.status] || STATUS_CONFIG.Learning;
  const StatusIcon = config.icon;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      {/* Preview area */}
      <div className="aspect-video bg-muted flex items-center justify-center relative">
        {ad.video_source ? (
          <a href={ad.video_source} target="_blank" rel="noopener noreferrer"
            className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/30 transition-colors group">
            <Play className="w-10 h-10 text-white/80 group-hover:text-white transition-colors" />
          </a>
        ) : (
          <Play className="w-10 h-10 text-muted-foreground/40" />
        )}
        {/* Score badge */}
        <span className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm text-foreground text-[11px] font-bold px-2 py-0.5 rounded">
          {ad.score}/100
        </span>
        {/* Status badge */}
        <Badge className={`absolute top-2 right-2 ${config.bgColor} ${config.color} border text-[11px] font-semibold`}>
          <StatusIcon className="w-3 h-3 mr-1" />{config.label}
        </Badge>
      </div>

      <CardContent className="p-3 space-y-2">
        <div>
          <p className="font-medium text-sm truncate" title={ad.ad_name}>{ad.ad_name}</p>
          <p className="text-xs text-muted-foreground truncate">{ad.campaign_name}</p>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Hook Rate</span>
            <span className={`font-medium ${ad.hook_rate >= 25 ? 'text-emerald-600' : ad.hook_rate >= 15 ? 'text-blue-600' : ad.hook_rate >= 8 ? 'text-amber-600' : 'text-red-600'}`}>
              {fmtPct(ad.hook_rate)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ret. 50%</span>
            <span className={`font-medium ${ad.retention_50 >= 50 ? 'text-emerald-600' : ad.retention_50 >= 35 ? 'text-blue-600' : ad.retention_50 >= 20 ? 'text-amber-600' : 'text-red-600'}`}>
              {fmtPct(ad.retention_50)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Completion</span>
            <span className={`font-medium ${ad.completion_rate >= 30 ? 'text-emerald-600' : ad.completion_rate >= 15 ? 'text-blue-600' : ad.completion_rate >= 8 ? 'text-amber-600' : 'text-red-600'}`}>
              {fmtPct(ad.completion_rate)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">CPM</span>
            <span className="font-medium">{fmtCurrency(ad.cpm)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Views 3s</span>
            <span className="font-medium">{fmtN(ad.video_3s)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Investimento</span>
            <span className="font-medium">{fmtCurrency(ad.spend)}</span>
          </div>
        </div>

        {/* Retention bar */}
        <div className="space-y-1 pt-0.5">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>3s</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
          </div>
          <div className="flex gap-0.5 h-1.5">
            {[
              { val: ad.video_3s, base: ad.impressions },
              { val: ad.video_p25, base: ad.video_3s },
              { val: ad.video_p50, base: ad.video_3s },
              { val: ad.video_p75, base: ad.video_3s },
              { val: ad.video_p100, base: ad.video_3s },
            ].map((seg, i) => {
              const pct = seg.base > 0 ? Math.min(100, (seg.val / seg.base) * 100) : 0;
              return (
                <div key={i} className="flex-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
