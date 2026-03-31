import { useState, useEffect, useCallback } from 'react';
import { Search, X, RefreshCw, Loader2, ImageIcon, Copy, ExternalLink, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccountContext } from '@/contexts/AccountContext';
import { DuplicateAdModal } from '@/components/creative/DuplicateAdModal';
import type { AdCreative } from '@/hooks/useCreativeIntelligence';

interface AdRow {
  ad_id: string;
  ad_name: string;
  ad_status: string | null;
  adset_status: string | null;
  campaign_status: string | null;
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  destination_url: string | null;
  creative_type: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
  media_best_url: string | null;
  video_thumbnail_url: string | null;
}

interface FilterOption { id: string; name: string; }
type SortField = 'ad_name' | 'campaign_name' | 'adset_name' | 'destination_url';
type SortDir = 'asc' | 'desc';

function useAds() {
  const { activeAccount } = useAccountContext();
  const [ads, setAds] = useState<AdRow[]>([]);
  const [allAds, setAllAds] = useState<AdRow[]>([]);
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
        adset_status: ad.adset_status ?? null,
        campaign_status: ad.campaign_status ?? null,
        campaign_id: ad.campaign_id,
        campaign_name: ad.campaign_name,
        adset_id: ad.adset_id,
        adset_name: ad.adset_name,
        destination_url: ad.destination_url ?? null,
        creative_type: ad.creative_type,
        image_url: ad.image_url,
        thumbnail_url: ad.thumbnail_url,
        media_best_url: ad.media_best_url,
        video_thumbnail_url: ad.video_thumbnail_url,
      }));

      setAds(rows);
      if (!selectedCampaign && !selectedAdset) {
        setAllAds(rows);
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

  const filteredAdsets = selectedCampaign
    ? adsets.filter(a => allAds.some(ad => ad.campaign_id === selectedCampaign && ad.adset_id === a.id))
    : adsets;

  return {
    ads, campaigns, adsets: filteredAdsets, loading, error,
    selectedCampaign, setSelectedCampaign,
    selectedAdset, setSelectedAdset,
    reload: fetchAds,
  };
}

function AdThumb({ ad }: { ad: AdRow }) {
  const src = ad.thumbnail_url || ad.image_url || ad.video_thumbnail_url || ad.media_best_url || null;
  if (!src) return (
    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
      <ImageIcon className="w-4 h-4 text-muted-foreground" />
    </div>
  );
  return <img src={src} alt="" className="w-10 h-10 rounded object-cover shrink-0" />;
}

function StatusBadge({ ad }: { ad: AdRow }) {
  const active = ad.campaign_status === 'ACTIVE' && ad.adset_status === 'ACTIVE' && ad.ad_status === 'ACTIVE';
  const hasStatus = ad.campaign_status || ad.adset_status || ad.ad_status;
  if (!hasStatus) return null;
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap ${
      active ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-muted-foreground bg-muted border-border'
    }`}>
      {active ? 'Ativo' : 'Inativo'}
    </span>
  );
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field) return <ChevronUp className="w-3 h-3 text-muted-foreground/40" />;
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 text-foreground" />
    : <ChevronDown className="w-3 h-3 text-foreground" />;
}

export default function CampanhasPage() {
  const {
    ads, campaigns, adsets, loading, error,
    selectedCampaign, setSelectedCampaign,
    selectedAdset, setSelectedAdset,
    reload,
  } = useAds();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [sortField, setSortField] = useState<SortField>('ad_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [duplicateAd, setDuplicateAd] = useState<AdCreative | null>(null);

  const isActive = (ad: AdRow) =>
    ad.campaign_status === 'ACTIVE' && ad.adset_status === 'ACTIVE' && ad.ad_status === 'ACTIVE';

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  const filtered = ads
    .filter(ad => {
      if (search.trim() && !ad.ad_name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      if (statusFilter === 'active' && !isActive(ad)) return false;
      if (statusFilter === 'inactive' && isActive(ad)) return false;
      return true;
    })
    .sort((a, b) => {
      const va = (a[sortField] ?? '').toLowerCase();
      const vb = (b[sortField] ?? '').toLowerCase();
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });

  const hasFilters = search || selectedCampaign || selectedAdset || statusFilter !== 'active';

  function ThHeader({ field, label, className = '' }: { field: SortField; label: string; className?: string }) {
    return (
      <th
        className={`px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide cursor-pointer select-none hover:text-foreground ${className}`}
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-1">
          {label}
          <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
        </div>
      </th>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 space-y-4">
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
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome..."
            className="h-8 w-48 rounded-md border border-input bg-background text-sm pl-8 pr-7 focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <Select value={selectedCampaign || '__all__'} onValueChange={v => { setSelectedCampaign(v === '__all__' ? '' : v); setSelectedAdset(''); }}>
          <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue placeholder="Todas as campanhas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as campanhas</SelectItem>
            {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>

        {selectedCampaign && (
          <Select value={selectedAdset || '__all__'} onValueChange={v => setSelectedAdset(v === '__all__' ? '' : v)}>
            <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue placeholder="Todos os conjuntos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os conjuntos</SelectItem>
              {adsets.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <div className="flex rounded-md border border-input overflow-hidden h-8">
          {(['all', 'active', 'inactive'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s === 'all' ? '' : s)}
              className={`px-3 text-xs font-medium transition-colors ${
                (s === 'all' ? !statusFilter : statusFilter === s)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              {s === 'all' ? 'Todos' : s === 'active' ? 'Ativos' : 'Inativos'}
            </button>
          ))}
        </div>

        {hasFilters && (
          <button
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            onClick={() => { setSearch(''); setSelectedCampaign(''); setSelectedAdset(''); setStatusFilter('active'); }}
          >
            <X className="w-3 h-3" /> Limpar
          </button>
        )}

        {!loading && (
          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length} anúncio{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm">{error}</div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-3 py-2.5 w-14"></th>
                <ThHeader field="ad_name" label="Anúncio" className="min-w-[180px]" />
                <ThHeader field="campaign_name" label="Campanha" className="min-w-[160px]" />
                <ThHeader field="adset_name" label="Conjunto" className="min-w-[160px]" />
                <ThHeader field="destination_url" label="Link de Destino" className="min-w-[180px]" />
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-24">Status</th>
                <th className="px-3 py-2.5 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-3 py-2.5"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground text-sm">
                    {search || selectedCampaign || selectedAdset || statusFilter
                      ? 'Nenhum anúncio encontrado para os filtros selecionados.'
                      : 'Nenhum anúncio sincronizado. Acesse Creative Intelligence e faça o sync.'}
                  </td>
                </tr>
              ) : (
                filtered.map(ad => (
                  <tr key={ad.ad_id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2">
                      <AdThumb ad={ad} />
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-medium text-sm line-clamp-2" title={ad.ad_name}>{ad.ad_name}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-sm text-muted-foreground truncate block max-w-[200px]" title={ad.campaign_name}>{ad.campaign_name}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-sm text-muted-foreground truncate block max-w-[200px]" title={ad.adset_name}>{ad.adset_name}</span>
                    </td>
                    <td className="px-3 py-2">
                      {ad.destination_url ? (
                        <a
                          href={ad.destination_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1 max-w-[220px]"
                          title={ad.destination_url}
                        >
                          <span className="truncate">{ad.destination_url.replace(/^https?:\/\//, '')}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge ad={ad} />
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => setDuplicateAd(ad as unknown as AdCreative)}
                      >
                        <Copy className="w-3 h-3" />
                        Duplicar
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DuplicateAdModal
        ad={duplicateAd}
        open={!!duplicateAd}
        onOpenChange={open => { if (!open) setDuplicateAd(null); }}
      />
    </div>
  );
}
