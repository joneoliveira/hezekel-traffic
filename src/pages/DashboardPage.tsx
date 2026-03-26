import { useState } from 'react';
import { useDashboard } from '@/hooks/useDashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Search, X, Filter, Calendar } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
const fmtN = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const fmtPct = (v: number) => `${v.toFixed(2)}%`;
const fmtDate = (d: string) => {
  const [, m, day] = d.split('-');
  return `${parseInt(day)} ${['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][parseInt(m)-1]}`;
};

function KPICard({ label, value, sub, goal, goalLabel, progress }: {
  label: string; value: string; sub?: string; goal?: string; goalLabel?: string; progress?: number;
}) {
  return (
    <div className="bg-[#0f0a04] border border-amber-900/40 rounded-xl p-4 flex flex-col gap-2">
      <p className="text-xs text-amber-300 font-medium uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && (
        <p className={`text-xs font-medium ${sub.startsWith('-') ? 'text-red-400' : 'text-emerald-400'}`}>{sub}</p>
      )}
      {progress !== undefined && (
        <div className="w-full bg-amber-900/20 rounded-full h-1.5 mt-1">
          <div
            className="h-1.5 rounded-full"
            style={{ width: `${Math.min(100, progress)}%`, background: progress < 50 ? '#ef4444' : progress < 80 ? '#f59e0b' : '#10b981' }}
          />
        </div>
      )}
      {goal && <p className="text-[11px] text-amber-500">Meta: {goal}{goalLabel}</p>}
    </div>
  );
}

function FunnelStep({ label, value, rate, rateLabel, isLast = false }: {
  label: string; value: string; rate?: string; rateLabel?: string; isLast?: boolean;
}) {
  return (
    <div className="flex items-stretch gap-2">
      <div className="flex-1 border-2 border-yellow-400 rounded-xl p-3 bg-[#0a0804]">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-xl font-bold text-white">{value}</p>
      </div>
      {rate && (
        <div className="flex flex-col items-center justify-center text-right min-w-[70px]">
          <p className="text-xs text-gray-400">{rateLabel}</p>
          <p className="text-sm font-bold text-white">{rate}</p>
        </div>
      )}
    </div>
  );
}

function DataTable({ title, rows, columns }: {
  title: string;
  rows: any[];
  columns: { key: string; label: string; format?: (v: any) => string }[];
}) {
  return (
    <div className="bg-[#0a0804] border border-slate-700/50 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700/50">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left px-4 py-2 text-xs text-gray-400 font-medium w-6">#</th>
              {columns.map(c => (
                <th key={c.key} className="text-left px-4 py-2 text-xs text-gray-400 font-medium">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-slate-700/20 hover:bg-slate-700/20 transition-colors">
                <td className="px-4 py-2 text-gray-500 text-xs">{i + 1}</td>
                {columns.map(c => (
                  <td key={c.key} className={`px-4 py-2 text-white ${c.key === 'name' ? 'max-w-[300px] truncate' : 'whitespace-nowrap'}`}>
                    {c.format ? c.format(row[c.key]) : row[c.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="bg-slate-800/40 font-semibold">
                <td className="px-4 py-2 text-gray-400 text-xs">—</td>
                {columns.map(c => {
                  if (c.key === 'name') return <td key={c.key} className="px-4 py-2 text-white text-xs">Total geral</td>;
                  const sum = rows.reduce((acc, r) => acc + (parseFloat(r[c.key]) || 0), 0);
                  return (
                    <td key={c.key} className="px-4 py-2 text-white text-xs whitespace-nowrap">
                      {c.format ? c.format(sum) : sum.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const DATE_PRESETS: { value: string; label: string }[] = [
  { value: 'last_7d', label: '7d' },
  { value: 'last_14d', label: '14d' },
  { value: 'last_30d', label: '30d' },
  { value: 'this_month', label: 'Mês' },
  { value: 'custom', label: 'Custom' },
];

export default function DashboardPage() {
  const { data, loading, error, datePreset, setDatePreset, since, setSince, until, setUntil, campaignFilter, setCampaignFilter } = useDashboard();
  const [search, setSearch] = useState('');

  if (loading) return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">{Array.from({length: 5}).map((_,i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      <Skeleton className="h-72 rounded-xl" />
      <div className="grid grid-cols-3 gap-4">{Array.from({length: 3}).map((_,i) => <Skeleton key={i} className="h-64 rounded-xl" />)}</div>
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-2 p-4 rounded-xl bg-red-950/50 border border-red-800 text-red-300">
      <AlertCircle className="w-5 h-5 flex-shrink-0" />{error}
    </div>
  );

  if (!data || !data.totals.spend) return (
    <div className="p-8 text-center text-gray-400">
      Nenhum dado encontrado. Faça um Sync Meta Data no Creative Intelligence.
    </div>
  );

  const { totals, daily, by_campaign, by_adset, by_ad, funnel } = data;

  const q = search.trim().toLowerCase();
  const filterRows = (rows: any[]) => q ? rows.filter(r => r.name?.toLowerCase().includes(q)) : rows;

  const tableColumns = [
    { key: 'name', label: 'Nome' },
    { key: 'spend', label: 'Investimento', format: fmt },
    { key: 'conversions', label: 'Vendas', format: (v: number) => fmtN(v) },
    { key: 'cpa', label: 'CPA', format: (v: number) => v > 0 ? fmt(v) : '—' },
    { key: 'ctr', label: 'CTR', format: fmtPct },
    { key: 'revenue', label: 'Receita', format: fmt },
  ];

  return (
    <div className="space-y-6 min-h-screen" style={{ background: 'linear-gradient(135deg, #0a0500 0%, #0f0a04 50%, #080600 100%)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-0.5">Performance Meta Ads</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Campaign filter chip */}
          <div className="flex items-center gap-1.5 h-9 px-3 rounded-md bg-amber-900/20 border border-amber-700/60 text-purple-200 text-sm">
            <Filter className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="text-amber-500 text-xs">campanha contém</span>
            <input
              value={campaignFilter}
              onChange={e => setCampaignFilter(e.target.value)}
              className="bg-transparent text-white text-sm w-20 focus:outline-none placeholder:text-amber-600"
              placeholder="ex: DCM"
            />
            {campaignFilter && (
              <button onClick={() => setCampaignFilter('')} className="text-amber-500 hover:text-white ml-1">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-500 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filtrar tabelas..."
              className="h-9 w-44 rounded-md bg-[#0f0a04] border border-amber-800/60 text-white text-sm pl-8 pr-7 focus:outline-none focus:ring-1 focus:ring-amber-600 placeholder:text-amber-600"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-amber-500 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {/* Date preset buttons */}
          <div className="flex items-center gap-1 bg-[#0f0a04] border border-amber-800/60 rounded-md p-0.5">
            {DATE_PRESETS.map(p => (
              <button
                key={p.value}
                onClick={() => setDatePreset(p.value as any)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  datePreset === p.value
                    ? 'bg-amber-700 text-white'
                    : 'text-amber-500 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom date range */}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-1.5 bg-[#0f0a04] border border-amber-800/60 rounded-md px-2 h-9">
              <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <input
                type="date"
                value={since}
                onChange={e => setSince(e.target.value)}
                className="bg-transparent text-white text-xs focus:outline-none"
              />
              <span className="text-amber-600 text-xs">→</span>
              <input
                type="date"
                value={until}
                onChange={e => setUntil(e.target.value)}
                className="bg-transparent text-white text-xs focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">
        <KPICard label="Investimento" value={fmt(totals.spend)} />
        <KPICard label="Vendas" value={fmtN(totals.conversions)} />
        <KPICard label="CPA" value={totals.cpa > 0 ? fmt(totals.cpa) : '—'} />
        <KPICard label="CTR" value={fmtPct(totals.ctr)} />
        <KPICard label="CPM" value={fmt(totals.cpm)} />
      </div>

      {/* Chart + Funnel */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Line Chart */}
        <div className="xl:col-span-2 bg-[#0a0804] border border-slate-700/50 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-4">Evolução diária</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={daily} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ background: '#0f0a04', border: '1px solid #78350f', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#fde68a' }}
                formatter={(v: any, name: any) => {
                  if (name === 'Investimento') return [fmt(v), name];
                  if (name === 'CPA') return [v > 0 ? fmt(v) : '—', name];
                  return [v, name];
                }}
                labelFormatter={(d: any) => fmtDate(String(d))}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
              <Line yAxisId="left" type="monotone" dataKey="spend" name="Investimento" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="conversions" name="Vendas" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="cpa" name="CPA" stroke="#e5e7eb" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Funnel */}
        <div className="bg-[#0a0804] border border-slate-700/50 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-4 text-center">Funil Tráfego</h2>
          <div className="space-y-2">
            <FunnelStep label="Impressions" value={fmtN(funnel.impressions)} />
            <FunnelStep label="Cliques" value={fmtN(funnel.clicks)} rate={fmtPct(funnel.ctr)} rateLabel="CTR" />
            <FunnelStep
              label="Vendas"
              value={fmtN(funnel.conversions)}
              rate={fmtPct(funnel.click_to_conversion)}
              rateLabel="Conv. Clique"
              isLast
            />
          </div>
          <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">CPM</span>
              <span className="text-white font-medium">{fmt(totals.cpm)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">CPA</span>
              <span className="text-white font-medium">{totals.cpa > 0 ? fmt(totals.cpa) : '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Receita</span>
              <span className="text-white font-medium">{fmt(totals.revenue)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tables */}
      <DataTable title="Por Campanha" rows={filterRows(by_campaign)} columns={tableColumns} />
      <DataTable title="Por Adset" rows={filterRows(by_adset)} columns={tableColumns} />
      <DataTable title="Por Ad" rows={filterRows(by_ad)} columns={tableColumns} />
    </div>
  );
}
