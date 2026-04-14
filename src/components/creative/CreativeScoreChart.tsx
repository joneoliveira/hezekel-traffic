import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea, CartesianGrid } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';

interface ScorePoint { date: string; score: number | null; status: string; }
interface AdsetPoint { date: string; score: number; }
interface Props { adId: string; adsetId: string; currentScore: number; currentStatus: string; }

const BAND_COLORS = {
  winner: 'hsl(142, 71%, 90%)', good: 'hsl(217, 91%, 90%)',
  risk: 'hsl(38, 92%, 90%)', bad: 'hsl(0, 84%, 92%)',
};

export default function CreativeScoreChart({ adId, adsetId, currentScore, currentStatus }: Props) {
  const [history, setHistory] = useState<ScorePoint[]>([]);
  const [adsetHistory, setAdsetHistory] = useState<AdsetPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const baseUrl = `${supabaseUrl}/functions/v1`;

    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ ad_id: adId, adset_id: adsetId });
        const res = await fetch(`${baseUrl}/creative-score-history?${params}`, {
          headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        });
        const data = await res.json();
        if (data.error) { setError(data.error); return; }
        setHistory(data.history || []);
        setAdsetHistory(data.adset_history || []);
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    };
    fetchHistory();
  }, [adId, adsetId]);

  const chartData = useMemo(() => {
    const adsetMap = new Map(adsetHistory.map(p => [p.date, p.score]));
    return history.filter(p => p.score !== null).map(p => ({
      date: p.date.slice(5), fullDate: p.date, score: p.score,
      adsetScore: adsetMap.get(p.date) ?? null,
    }));
  }, [history, adsetHistory]);

  const trendSummary = useMemo(() => {
    const valid = history.filter(p => p.score !== null);
    if (valid.length < 2) return null;
    const summaries: string[] = [];
    const last14 = valid.slice(-14);
    if (last14.length >= 2) {
      const diff = (last14[last14.length - 1].score ?? 0) - (last14[0].score ?? 0);
      if (diff <= -15) summaries.push(`Score caiu ${Math.abs(Math.round(diff))} pontos nos últimos ${last14.length} dias`);
      else if (diff >= 15) summaries.push(`Score subiu ${Math.round(diff)} pontos nos últimos ${last14.length} dias`);
    }
    let consecutive = 0; let consecutiveStatus = '';
    for (let i = valid.length - 1; i >= 0; i--) {
      const s = valid[i].status;
      if (s === 'Risk' || s === 'Bad') { if (consecutive === 0) consecutiveStatus = s; consecutive++; } else break;
    }
    if (consecutive >= 4) summaries.push(`Criativo em ${consecutiveStatus} há ${consecutive} dias consecutivos`);
    if (valid.length >= 7) {
      const last7 = valid.slice(-7); let declining = 0;
      for (let i = 1; i < last7.length; i++) { if ((last7[i].score ?? 0) < (last7[i - 1].score ?? 0)) declining++; }
      if (declining >= 5) summaries.push('Possível fadiga criativa — score em queda constante');
    }
    return summaries.length > 0 ? summaries : null;
  }, [history]);

  if (loading) return <Skeleton className="h-64 w-full rounded-lg" />;
  if (error) return <Card><CardContent className="p-4 text-sm text-red-600">Erro: {error}</CardContent></Card>;
  if (chartData.length < 2) return (
    <Card><CardContent className="p-4 text-sm text-muted-foreground text-center">Dados insuficientes para exibir tendência.</CardContent></Card>
  );

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Tendência do Creative Score (30 dias)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <ReferenceArea y1={85} y2={100} fill={BAND_COLORS.winner} fillOpacity={0.4} />
            <ReferenceArea y1={70} y2={85} fill={BAND_COLORS.good} fillOpacity={0.4} />
            <ReferenceArea y1={45} y2={70} fill={BAND_COLORS.risk} fillOpacity={0.4} />
            <ReferenceArea y1={0} y2={45} fill={BAND_COLORS.bad} fillOpacity={0.4} />
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-background border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
                  <p className="font-medium">{d.fullDate}</p>
                  <p>Score: <span className="font-bold">{d.score}</span></p>
                  {d.adsetScore !== null && <p className="text-muted-foreground">Média adset: {d.adsetScore}</p>}
                </div>
              );
            }} />
            <Line type="monotone" dataKey="adsetScore" stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls />
            <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))"
              strokeWidth={2.5} dot={{ r: 2.5, fill: 'hsl(var(--primary))' }}
              activeDot={{ r: 4, fill: 'hsl(var(--primary))' }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground px-1">
          <div className="flex items-center gap-1"><div className="w-4 h-0.5 bg-primary rounded" /><span>Score do Ad</span></div>
          <div className="flex items-center gap-1"><div className="w-4 h-0.5 border-t border-dashed border-muted-foreground" /><span>Média Adset</span></div>
          <div className="flex items-center gap-1 ml-auto">
            {Object.entries(BAND_COLORS).map(([k, v]) => <><div key={k} className="w-2 h-2 rounded-sm ml-1" style={{ background: v }} />{k.charAt(0).toUpperCase() + k.slice(1)}</>)}
          </div>
        </div>
        {trendSummary && (
          <div className="space-y-1.5 pt-1">
            {trendSummary.map((msg, i) => {
              const isNeg = msg.includes('caiu') || msg.includes('fadiga') || msg.includes('Risk') || msg.includes('Bad');
              const isPos = msg.includes('subiu');
              const Icon = isNeg ? TrendingDown : isPos ? TrendingUp : AlertTriangle;
              const color = isNeg ? 'text-red-600' : isPos ? 'text-emerald-600' : 'text-amber-600';
              const bg = isNeg ? 'bg-red-50 border-red-200' : isPos ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200';
              return (
                <div key={i} className={`flex items-center gap-2 p-2 rounded-lg border text-xs ${bg}`}>
                  <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${color}`} />
                  <span className={color}>{msg}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
