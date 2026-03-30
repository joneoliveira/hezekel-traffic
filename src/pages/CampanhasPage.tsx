import { useState, useEffect, useCallback } from 'react';
import { Search, X, RefreshCw, Loader2, ImageIcon, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccountContext } from '@/contexts/AccountContext';
import { DuplicateAdModal } from '@/components/creative/DuplicateAdModal';
import type { AdCreative } from '@/hooks/useCreativeIntelligence';

interface AdRow {
  ad_id: string;
  ad_name: string;
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  ad_status: string | null;
  creative_type: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
  media_best_url: string | null;
  video_thumbnail_url: string | null;
}

interface FilterOption { id: string; name: string; }

function useAds() {
  const { activeAccount } = useAccountContext();
  const [ads, setAds] = useState<AdRow[]>([]);
  const [campaigns, setCampaigns] = useState<FilterOption[]>([]);
  const [adsets, setAdsets] = useState<FilterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [selectedAdset, setSelectedAdset] = useState('');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const fetchAds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Use the existing edge function (service_role bypasses RLS)
      const params = new URLSearchParams({ date_preset: 'last_30d' });
      if (activeAccount?.ad_account_id) params.set('account_id', activeAccount.ad_account_id);
      if (selectedCampaign) params.set('campaign_id', selectedCampaign);
      if (selectedAdset) params.set('adset_id', selectedAdset);

      const res = await fetch(`${supabaseUrl}/functions/v1/creative-intelligence-feed?${params}`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);

      const rows: AdRow[] = (result.ads ?? []).map((ad: any) => ({
        ad_id: ad.ad_id,
        ad_name: ad.ad_name,
        ad_status: ad.ad_status ?? null,
        campaign_id: ad.campaign_id,
        campaign_name: ad.campaign_name,
        adset_id: ad.adset_id,
        adset_name: ad.adset_name,
        creative_type: ad.creative_type,
        image_url: ad.image_url,
        thumbnail_url: ad.thumbnail_url,
        media_best_url: ad.media_best_url,
        video_thumbnail_url: ad.video_thumbnail_url,
      }));

      setAds(rows);

      if (!selectedCampaign && !selectedAdset) {
        setCampaigns(result.campaigns ?? []);
        setAdsets(result.adsets ?? []);
      }
    } catch (err: any) {
      setError(err.message ?? 'Erro ao carregar anúncios');
    } finally {
      setLoading(false);
    }
  }, [activeAccount?.ad_account_id, selectedCampaign, selectedAdset, supabaseUrl, anonKey]);

  useEffect(() => {
    setSelectedCampaign('');
    setSelectedAdset('');
  }, [activeAccount?.ad_account_id]);

  useEffect(() => { fetchAds(); }, [fetchAds]);

  // Filter adsets by selected campaign
  const filteredAdsets = selectedCampaign
    ? adsets.filter(a => ads.some(ad => ad.campaign_id === selectedCampaign && ad.adset_id === a.id))
    : adsets;

  return {
    ads, campaigns, adsets: filteredAdsets, loading, error,
    selectedCampaign, setSelectedCampaign,
    selectedAdset, setSelectedAdset,
    reload: fetchAds,
  };
}

function AdThumbnail({ ad }: { ad: AdRow }) {
  const src = ad.thumbnail_url || ad.image_url || ad.video_thumbnail_url || ad.media_best_url || null;
  if (!src) {
    return (
      <div className="w-full aspect-video bg-muted flex items-center justify-center">
        <ImageIcon className="w-6 h-6 text-muted-foreground" />
      </div>
    );
  }
  return <img src={src} alt={ad.ad_name} className="w-full aspect-video object-cover" />;
}

export default function CampanhasPage() {
  const {
    ads, campaigns, adsets, loading, error,
    selectedCampaign, setSelectedCampaign,
    selectedAdset, setSelectedAdset,
    reload,
  } = useAds();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [duplicateAd, setDuplicateAd] = useState<AdCreative | null>(null);

  const filtered = ads.filter(ad => {
    if (search.trim() && !ad.ad_name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (statusFilter === 'active' && ad.ad_status !== 'ACTIVE') return false;
    if (statusFilter === 'inactive' && ad.ad_status === 'ACTIVE') return false;
    return true;
  });

  function openDuplicate(ad: AdRow) {
    // Cast to AdCreative (only the fields used by DuplicateAdModal are needed)
    setDuplicateAd(ad as unknown as AdCreative);
  }

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campanhas</h1>
          <p className="text-muted-foreground mt-1">Gerencie e duplique seus anúncios</p>
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
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

        <Select value={selectedCampaign || '__all__'} onValueChange={v => { setSelectedCampaign(v === '__all__' ? '' : v); setSelectedAdset(''); }}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Todas as campanhas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as campanhas</SelectItem>
            {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={selectedAdset || '__all__'} onValueChange={v => setSelectedAdset(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Todos os conjuntos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os conjuntos</SelectItem>
            {adsets.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={statusFilter || '__all__'} onValueChange={v => setStatusFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>

        {(selectedCampaign || selectedAdset || search || statusFilter) && (
          <Button variant="ghost" size="sm" className="text-muted-foreground h-9"
            onClick={() => { setSelectedCampaign(''); setSelectedAdset(''); setSearch(''); setStatusFilter(''); }}>
            <X className="w-3.5 h-3.5 mr-1" /> Limpar filtros
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Ad count */}
      {!loading && filtered.length > 0 && (
        <p className="text-sm text-muted-foreground">{filtered.length} anúncio{filtered.length !== 1 ? 's' : ''}</p>
      )}

      {/* List */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          {search || selectedCampaign || selectedAdset || statusFilter
            ? 'Nenhum anúncio encontrado para os filtros selecionados.'
            : 'Nenhum anúncio sincronizado. Acesse Creative Intelligence e faça o sync.'}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(ad => (
            <Card key={ad.ad_id} className="overflow-hidden hover:shadow-md transition-shadow">
              <div className="overflow-hidden">
                <AdThumbnail ad={ad} />
              </div>
              <CardContent className="p-3 space-y-2">
                <div>
                  <div className="flex items-start justify-between gap-1 mb-0.5">
                    <p className="font-medium text-sm truncate flex-1" title={ad.ad_name}>{ad.ad_name}</p>
                    {ad.ad_status && (
                      <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                        ad.ad_status === 'ACTIVE'
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                          : 'text-muted-foreground bg-muted border-border'
                      }`}>
                        {ad.ad_status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-primary/80 truncate"><span className="font-medium">Conjunto:</span> {ad.adset_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{ad.campaign_name}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-7 gap-1.5"
                  onClick={() => openDuplicate(ad)}
                >
                  <Copy className="w-3 h-3" />
                  Duplicar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DuplicateAdModal
        ad={duplicateAd}
        open={!!duplicateAd}
        onOpenChange={open => { if (!open) setDuplicateAd(null); }}
      />
    </div>
  );
}
