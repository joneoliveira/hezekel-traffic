import { useState } from 'react';
import { useContentPerformance } from '@/hooks/useContentPerformance';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Calendar, RefreshCw, Lock, Unlock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
const fmtN = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const fmtPct = (v: number) => `${v.toFixed(2)}%`;
const dash = (v: number) => v > 0 ? fmtN(v) : '—';

const COLUMNS = [
  { key: 'video_source', label: 'Link do Conteúdo', render: (v: any) =>
    v ? <a href={v} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 underline text-xs truncate max-w-[180px] block">Ver vídeo</a> : <span className="text-gray-500">—</span>
  },
  { key: 'spend', label: 'Investimento', render: (v: number) => fmt(v) },
  { key: 'impressions', label: 'Impressões', render: (v: number) => fmtN(v) },
  { key: 'cpm', label: 'CPM', render: (v: number) => fmt(v) },
  { key: 'reach', label: 'Alcance', render: (v: number) => fmtN(v) },
  { key: 'video_3s', label: 'Views 3s', render: (v: number) => dash(v) },
  { key: 'video_p25', label: 'Views 25%', render: (v: number) => dash(v) },
  { key: 'video_p50', label: 'Views 50%', render: (v: number) => dash(v) },
  { key: 'video_p75', label: 'Views 75%', render: (v: number) => dash(v) },
  { key: 'video_p100', label: 'Views 100%', render: (v: number) => dash(v) },
  { key: 'ctr', label: 'CTR', render: (v: number) => fmtPct(v) },
  { key: 'cpc', label: 'CPC', render: (v: number) => v > 0 ? fmt(v) : '—' },
  { key: 'cost_per_view_50', label: 'Custo/View 50%', render: (v: number) => v > 0 ? fmt(v) : '—' },
];

export default function ContentPerformancePage() {
  const { rows, loading, error, since, setSince, until, setUntil, campaignFilter, saveCampaignFilter, reload } = useContentPerformance();
  const [filterInput, setFilterInput] = useState(campaignFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Performance de Conteúdo</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Campanhas Descoberta
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
                className="h-9 w-44 rounded-md border border-input bg-background text-xs text-foreground pl-8 pr-2 focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
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

          <Button variant="outline" size="sm" onClick={reload} className="h-9">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Atualizar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-950/50 border border-red-800 text-red-300">
          <AlertCircle className="w-5 h-5 shrink-0" />{error}
        </div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          Nenhum dado encontrado para o período selecionado.
        </div>
      ) : (
        <div className="space-y-6">
          {rows.map(({ week, ads }) => (
            <div key={week} className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Week header */}
              <div className="px-4 py-2.5 bg-amber-900/20 border-b border-border flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-sm font-semibold text-amber-300">{week}</span>
                <span className="text-xs text-muted-foreground ml-1">· {ads.length} {ads.length === 1 ? 'anúncio' : 'anúncios'}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium whitespace-nowrap">Anúncio</th>
                      {COLUMNS.map(c => (
                        <th key={c.key} className="text-left px-3 py-2 text-xs text-muted-foreground font-medium whitespace-nowrap">{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ads.map((ad, i) => (
                      <tr key={ad.ad_id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                        <td className="px-4 py-2.5 text-white text-xs max-w-[200px]">
                          <p className="truncate font-medium">{ad.ad_name}</p>
                        </td>
                        {COLUMNS.map(c => (
                          <td key={c.key} className="px-3 py-2.5 text-white text-xs whitespace-nowrap">
                            {c.render((ad as any)[c.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
