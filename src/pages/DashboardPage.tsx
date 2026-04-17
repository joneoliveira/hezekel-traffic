import { useState } from 'react';
import { useDashboard } from '@/hooks/useDashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Search, X, Calendar } from 'lucide-react';
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

function KPICard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex flex-col gap-1">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {sub && (
          <p className={`text-xs font-medium ${sub.startsWith('-') ? 'text-red-500' : 'text-emerald-500'}`}>{sub}</p>
        )}
      </CardContent>
    </Card>
  );
}

function FunnelStep({ label, value, rate, rateLabel, borderColor = 'border-border' }: {
  label: string; value: string; rate?: string; rateLabel?: string; borderColor?: string;
}) {
  return (
    <div className="flex items-stretch gap-2">
      <div className={`flex-1 border-2 ${borderColor} rounded-xl p-3 bg-card`}>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
      </div>
      {rate && (
        <div className="flex flex-col items-center justify-center text-right min-w-[70px]">
          <p className="text-xs text-muted-foreground">{rateLabel}</p>
          <p className="text-sm font-bold text-foreground">{rate}</p>
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
    <Card>
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium w-6">#</th>
              {columns.map(c => (
                <th key={c.key} className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                <td className="px-4 py-2 text-muted-foreground text-xs">{i + 1}</td>
                {columns.map(c => (
                  <td key={c.key} className={`px-4 py-2 text-foreground ${c.key === 'name' ? 'max-w-[300px] truncate' : 'whitespace-nowrap'}`}>
                    {c.format ? c.format(row[c.key]) : row[c.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="bg-muted/40 font-semibold">
                <td className="px-4 py-2 text-muted-foreground text-xs">—</td>
                {columns.map(c => {
                  if (c.key === 'name') return <td key={c.key} className="px-4 py-2 text-foreground text-xs">Total geral</td>;
                  const sum = rows.reduce((acc, r) => acc + (parseFloat(r[c.key]) || 0), 0);
                  return (
                    <td key={c.key} className="px-4 py-2 text-foreground text-xs whitespace-nowrap">
                      {c.format ? c.format(sum) : sum.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
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
  const { data, loading, error, datePreset, setDatePreset, since, setSince, until, setUntil } = useDashboard();
  const [search, setSearch] = useState('');

  if (loading) return (
    <div className="space-y-4 p-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">{Array.from({length: 5}).map((_,i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      <Skeleton className="h-72 rounded-xl" />
      <div className="grid grid-cols-3 gap-4">{Array.from({length: 3}).map((_,i) => <Skeleton key={i} className="h-64 rounded-xl" />)}</div>
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 m-6">
      <AlertCircle className="w-5 h-5 flex-shrink-0" />{error}
    </div>
  );

  if (!data || !data.totals.spend) return (
    <div className="p-8 text-center text-muted-foreground">
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
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Performance Meta Ads</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filtrar tabelas..."
              className="h-9 w-44 rounded-md bg-background border border-input text-foreground text-sm pl-8 pr-7 focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {/* Date preset buttons */}
          <div className="flex items-center gap-1 bg-card border border-input rounded-md p-0.5">
            {DATE_PRESETS.map(p => (
              <button
                key={p.value}
                onClick={() => setDatePreset(p.value as any)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  datePreset === p.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {datePreset === 'custom' && (
            <div className="flex items-center gap-1.5 bg-card border border-input rounded-md px-2 h-9">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                type="date"
                value={since}
                onChange={e => setSince(e.target.value)}
                className="bg-transparent text-foreground text-xs focus:outline-none"
              />
              <span className="text-muted-foreground text-xs">→</span>
              <input
                type="date"
                value={until}
                onChange={e => setUntil(e.target.value)}
                className="bg-transparent text-foreground text-xs focus:outline-none"
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
        <Card className="xl:col-span-2 p-4">
          <h2 className="text-sm font-semibold mb-4">Evolução diária</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={daily} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip
                contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                formatter={(v: any, name: any) => {
                  if (name === 'Investimento') return [fmt(v), name];
                  if (name === 'CPA') return [v > 0 ? fmt(v) : '—', name];
                  return [v, name];
                }}
                labelFormatter={(d: any) => fmtDate(String(d))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="left" type="monotone" dataKey="spend" name="Investimento" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="conversions" name="Vendas" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="cpa" name="CPA" stroke="#6b7280" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Funnel */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-4 text-center">Funil Tráfego</h2>
          <div className="space-y-2">
            <FunnelStep label="Impressions" value={fmtN(funnel.impressions)} borderColor="border-border" />
            <FunnelStep label="Cliques" value={fmtN(funnel.clicks)} rate={fmtPct(funnel.ctr)} rateLabel="CTR" borderColor="border-amber-400" />
            <FunnelStep
              label="Vendas"
              value={fmtN(funnel.conversions)}
              rate={fmtPct(funnel.click_to_conversion)}
              rateLabel="Conv. Clique"
              borderColor="border-emerald-500"
            />
          </div>
          <div className="mt-4 pt-4 border-t border-border space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">CPM</span>
              <span className="text-foreground font-medium">{fmt(totals.cpm)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">CPA</span>
              <span className="text-foreground font-medium">{totals.cpa > 0 ? fmt(totals.cpa) : '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Receita</span>
              <span className="text-foreground font-medium">{fmt(totals.revenue)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Tables */}
      <DataTable title="Por Campanha" rows={filterRows(by_campaign)} columns={tableColumns} />
      <DataTable title="Por Adset" rows={filterRows(by_adset)} columns={tableColumns} />
      <DataTable title="Por Ad" rows={filterRows(by_ad)} columns={tableColumns} />
    </div>
  );
}
