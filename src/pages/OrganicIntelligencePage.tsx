import { useOrganicIntelligence, type OrganicPost } from '@/hooks/useOrganicIntelligence';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertCircle, RefreshCw, Loader2, Trophy, ThumbsUp,
  AlertTriangle, XCircle, GraduationCap, Calendar, Search, X,
  Download, Play, Image, Film, LayoutGrid, Users, TrendingUp, TrendingDown,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ComponentType<any> }> = {
  Winner:   { label: 'Winner',   color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200', icon: Trophy },
  Good:     { label: 'Good',     color: 'text-blue-700',    bgColor: 'bg-blue-50 border-blue-200',       icon: ThumbsUp },
  Risk:     { label: 'Risk',     color: 'text-amber-700',   bgColor: 'bg-amber-50 border-amber-200',     icon: AlertTriangle },
  Bad:      { label: 'Bad',      color: 'text-red-700',     bgColor: 'bg-red-50 border-red-200',         icon: XCircle },
  Learning: { label: 'Learning', color: 'text-muted-foreground', bgColor: 'bg-muted border-border',      icon: GraduationCap },
};

const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmtN = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const fmtTime = (ms: number) => {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${s % 60 > 0 ? ` ${s % 60}s` : ''}`;
};

function mediaTypeIcon(post: OrganicPost) {
  const t = post.media_product_type || post.media_type || '';
  if (t === 'REELS') return <Film className="w-3 h-3" />;
  if (t === 'VIDEO') return <Play className="w-3 h-3" />;
  if (t === 'CAROUSEL_ALBUM') return <LayoutGrid className="w-3 h-3" />;
  return <Image className="w-3 h-3" />;
}

export default function OrganicIntelligencePage() {
  const {
    posts, summary, loading, error, syncing, syncResult,
    since, setSince, until, setUntil,
    selectedStatus, setSelectedStatus,
    selectedType, setSelectedType,
    search, setSearch,
    followersNow, followersGrowth,
    reload, syncData,
  } = useOrganicIntelligence();

  const summaryCards = [
    { key: 'Winner',   icon: Trophy,        count: summary.Winner,   color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { key: 'Good',     icon: ThumbsUp,      count: summary.Good,     color: 'text-blue-600',    bg: 'bg-blue-50' },
    { key: 'Risk',     icon: AlertTriangle, count: summary.Risk,     color: 'text-amber-600',   bg: 'bg-amber-50' },
    { key: 'Bad',      icon: XCircle,       count: summary.Bad,      color: 'text-red-600',     bg: 'bg-red-50' },
    { key: 'Learning', icon: GraduationCap, count: summary.Learning, color: 'text-muted-foreground', bg: 'bg-muted' },
  ];

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Content Intelligence — Organic</h1>
          <p className="text-muted-foreground mt-1">Análise de posts orgânicos · Império Médico</p>
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
          <Button variant="outline" size="sm" onClick={syncData} disabled={syncing} className="h-9">
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
            Sincronizar
          </Button>
          <Button variant="outline" size="sm" onClick={reload} disabled={loading} className="h-9">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {syncResult && (
        <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm">
          {syncResult}
        </div>
      )}

      {/* Follower card */}
      {followersNow != null && (
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{fmtN(followersNow)}</p>
              <p className="text-xs text-muted-foreground">Seguidores</p>
            </div>
            {followersGrowth != null && followersGrowth !== 0 && (
              <div className={`flex items-center gap-1 ml-4 text-sm font-semibold ${followersGrowth > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {followersGrowth > 0
                  ? <TrendingUp className="w-4 h-4" />
                  : <TrendingDown className="w-4 h-4" />}
                {followersGrowth > 0 ? '+' : ''}{fmtN(followersGrowth)} no período
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
            placeholder="Filtrar por caption..."
            className="h-9 w-52 rounded-md border border-input bg-background text-sm pl-8 pr-7 focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Select value={selectedType || '__all__'} onValueChange={v => setSelectedType(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os tipos</SelectItem>
            <SelectItem value="REELS">Reels</SelectItem>
            <SelectItem value="IMAGE">Foto</SelectItem>
            <SelectItem value="CAROUSEL_ALBUM">Carrossel</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedStatus || '__all__'} onValueChange={v => setSelectedStatus(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os status</SelectItem>
            {Object.keys(STATUS_CONFIG).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-80 rounded-xl" />)}
        </div>
      ) : posts.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          Nenhum post encontrado. Clique em "Sincronizar" para importar os posts do Instagram.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {posts.map(post => <OrganicCard key={post.id} post={post} />)}
        </div>
      )}
    </div>
  );
}

function OrganicCard({ post }: { post: OrganicPost }) {
  const config = STATUS_CONFIG[post.status] || STATUS_CONFIG.Learning;
  const StatusIcon = config.icon;
  const thumb = post.thumbnail_url || post.media_url;
  const isVideo = post.media_type === 'VIDEO' || post.media_product_type === 'REELS';

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <a href={post.permalink || '#'} target="_blank" rel="noopener noreferrer">
        <div className="aspect-video bg-muted relative overflow-hidden">
          {thumb ? (
            <img src={thumb} alt={post.caption?.slice(0, 40) || 'Post'} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {isVideo ? <Play className="w-10 h-10 text-muted-foreground/40" /> : <Image className="w-10 h-10 text-muted-foreground/40" />}
            </div>
          )}
          {/* Overlays */}
          <span className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm text-foreground text-[11px] font-bold px-2 py-0.5 rounded">
            {post.score}/100
          </span>
          <Badge className={`absolute top-2 right-2 ${config.bgColor} ${config.color} border text-[11px] font-semibold`}>
            <StatusIcon className="w-3 h-3 mr-1" />{config.label}
          </Badge>
          <span className="absolute bottom-2 left-2 flex items-center gap-1 bg-background/80 backdrop-blur-sm text-muted-foreground text-[10px] px-1.5 py-0.5 rounded">
            {mediaTypeIcon(post)}
            {post.media_product_type || post.media_type || '—'}
          </span>
        </div>
      </a>

      <CardContent className="p-3 space-y-2">
        {/* Caption */}
        <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2.5rem]">
          {post.caption || <span className="italic">Sem legenda</span>}
        </p>

        {/* Date */}
        {post.timestamp && (
          <p className="text-[10px] text-muted-foreground">
            {new Date(post.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Alcance</span>
            <span className="font-medium">{fmtN(post.reach)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Views</span>
            <span className="font-medium">{fmtN(post.views)}</span>
          </div>
          {isVideo && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg Watch</span>
              <span className="font-medium">{fmtTime(post.avg_watch_time_ms)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Engajamento</span>
            <span className={`font-medium ${post.engagement_rate >= 6 ? 'text-emerald-600' : post.engagement_rate >= 3 ? 'text-blue-600' : post.engagement_rate >= 1 ? 'text-amber-600' : 'text-red-600'}`}>
              {fmtPct(post.engagement_rate)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Interações</span>
            <span className="font-medium">{fmtN(post.total_interactions)}</span>
          </div>
        </div>

        {/* Interaction breakdown */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-0.5">
          <span>❤️ {fmtN(post.likes)}</span>
          <span>💬 {fmtN(post.comments)}</span>
          <span>↗️ {fmtN(post.shares)}</span>
          <span>🔖 {fmtN(post.saved)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
