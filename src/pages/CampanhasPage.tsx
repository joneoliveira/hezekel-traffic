import { useState, useEffect, useCallback } from 'react';
import { Search, X, RefreshCw, Loader2, ImageIcon, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
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

  const fetchAds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('meta_ad_creatives')
        .select('ad_id,ad_name,campaign_id,campaign_name,adset_id,adset_name,creative_type,image_url,thumbnail_url,media_best_url,video_thumbnail_url')
        .order('campaign_name', { ascending: true })
        .order('adset_name', { ascending: true })
        .order('ad_name', { ascending: true });

      if (activeAccount?.ad_account_id) {
        query = query.eq('account_id', activeAccount.ad_account_id);
      }
      if (selectedCampaign) query = query.eq('campaign_id', selectedCampaign);
      if (selectedAdset) query = query.eq('adset_id', selectedAdset);

      const { data, error: err } = await query.limit(500);
      if (err) throw err;

      const rows = (data ?? []) as AdRow[];
      setAds(rows);

      // Build filter options from full unfiltered data if no campaign filter
      if (!selectedCampaign && !selectedAdset) {
        const campMap = new Map<string, string>();
        const adsetMap = new Map<string, string>();
        rows.forEach(r => {
          campMap.set(r.campaign_id, r.campaign_name);
          adsetMap.set(r.adset_id, r.adset_name);
        });
        setCampaigns(Array.from(campMap.entries()).map(([id, name]) => ({ id, name })));
        setAdsets(Array.from(adsetMap.entries()).map(([id, name]) => ({ id, name })));
      }
    } catch (err: any) {
      setError(err.message ?? 'Erro ao carregar anúncios');
    } finally {
      setLoading(false);
    }
  }, [activeAccount?.ad_account_id, selectedCampaign, selectedAdset]);

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
  const [duplicateAd, setDuplicateAd] = useState<AdCreative | null>(null);

  const filtered = ads.filter(ad =>
    !search.trim() || ad.ad_name.toLowerCase().includes(search.trim().toLowerCase())
  );

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

        {(selectedCampaign || selectedAdset || search) && (
          <Button variant="ghost" size="sm" className="text-muted-foreground h-9"
            onClick={() => { setSelectedCampaign(''); setSelectedAdset(''); setSearch(''); }}>
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
          {search || selectedCampaign || selectedAdset
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
                  <p className="font-medium text-sm truncate" title={ad.ad_name}>{ad.ad_name}</p>
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
