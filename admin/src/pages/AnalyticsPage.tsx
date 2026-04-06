import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, TrendingUp, TrendingDown, Minus, Eye, Users, MousePointerClick, Percent, ArrowUpRight, RefreshCw } from 'lucide-react';
import { useAnalytics } from '../hooks/useFetchAnalytics';

type SortKey = 'pageviews' | 'uniques' | 'cta_clicks' | 'cta_rate' | 'trend';
type SortDir = 'asc' | 'desc';

const fmt = (n: number) => n.toLocaleString('pt-BR');
const fmtPct = (n: number) => n.toFixed(1).replace('.', ',') + '%';

export default function AnalyticsPage() {
  const { data, loading, period, setPeriod, refetch } = useAnalytics();
  const [sortKey, setSortKey] = useState<SortKey>('pageviews');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const navigate = useNavigate();

  const sorted = useMemo(() => {
    if (!data?.pages) return [];
    return [...data.pages].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      return sortDir === 'desc' ? bv - av : av - bv;
    });
  }, [data, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  const periods = [
    { value: 'today' as const, label: 'Hoje' },
    { value: '7d' as const, label: '7 dias' },
    { value: '30d' as const, label: '30 dias' },
  ];

  const s = data?.summary;

  const statCards = s ? [
    { label: 'Visitas', value: fmt(s.total_pageviews), icon: <Eye className="w-5 h-5" />, color: 'text-primary', gradient: 'from-primary/10 to-transparent' },
    { label: 'Visitantes', value: fmt(s.total_uniques), icon: <Users className="w-5 h-5" />, color: 'text-accent', gradient: 'from-accent/10 to-transparent' },
    { label: 'Cliques CTA', value: fmt(s.total_cta_clicks), icon: <MousePointerClick className="w-5 h-5" />, color: 'text-primary', gradient: 'from-primary/10 to-transparent' },
    { label: 'Taxa CTA', value: fmtPct(s.avg_cta_rate), icon: <Percent className="w-5 h-5" />, color: 'text-warning', gradient: 'from-warning/10 to-transparent' },
  ] : [];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-text">Analytics</h1>
          </div>
          <p className="text-sm text-text-muted mt-1">Acompanhe visitas e conversões das suas páginas.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={loading}
            className="p-2 rounded-xl bg-surface-2/80 text-text-muted hover:text-text hover:bg-surface-2 transition-all duration-200 cursor-pointer disabled:opacity-50"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex gap-1 bg-surface-2/80 rounded-xl p-1">
            {periods.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg cursor-pointer transition-all duration-200 ${
                  period === p.value
                    ? 'bg-surface shadow-sm text-text'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-surface border border-border/50 rounded-2xl p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl animate-shimmer" />
              <div>
                <div className="h-7 w-16 rounded animate-shimmer mb-1" />
                <div className="h-4 w-20 rounded animate-shimmer" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map(card => (
            <div
              key={card.label}
              className="bg-surface border border-border/50 rounded-2xl p-5 flex items-center gap-4 hover:border-border-hover transition-all duration-200 relative overflow-hidden card-hover"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} pointer-events-none`} />
              <div className={`relative w-11 h-11 rounded-xl bg-surface-2/80 flex items-center justify-center ${card.color}`}>
                {card.icon}
              </div>
              <div className="relative">
                <p className="text-2xl font-bold text-text">{card.value}</p>
                <p className="text-sm text-text-muted">{card.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ranked Table */}
      <div>
        <h2 className="text-lg font-semibold text-text mb-1">Performance por Pagina</h2>
        <p className="text-sm text-text-muted mb-4">Clique em uma linha para ver detalhes.</p>

        <div className="bg-surface border border-border/50 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="divide-y divide-border/50">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-4 w-6 rounded animate-shimmer" />
                  <div className="h-4 w-48 rounded animate-shimmer" />
                  <div className="ml-auto flex gap-8">
                    {[...Array(5)].map((_, j) => (
                      <div key={j} className="h-4 w-14 rounded animate-shimmer" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : !sorted.length ? (
            <div className="p-10 text-center">
              <BarChart3 className="w-10 h-10 text-text-muted/40 mx-auto mb-3" />
              <p className="text-text-muted font-medium">Nenhum dado para o periodo</p>
              <p className="text-text-muted/60 text-sm mt-1">Os dados aparecem quando suas paginas publicadas recebem visitas.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left text-xs font-medium text-text-muted uppercase tracking-wider px-5 py-3 w-10">#</th>
                  <th className="text-left text-xs font-medium text-text-muted uppercase tracking-wider px-5 py-3">Pagina</th>
                  {([
                    ['pageviews', 'Visitas'],
                    ['uniques', 'Unicos'],
                    ['cta_clicks', 'Cliques CTA'],
                    ['cta_rate', 'Taxa CTA'],
                    ['trend', 'Tendencia'],
                  ] as [SortKey, string][]).map(([key, label]) => (
                    <th
                      key={key}
                      onClick={() => toggleSort(key)}
                      className="text-right text-xs font-medium text-text-muted uppercase tracking-wider px-5 py-3 cursor-pointer hover:text-text select-none transition-colors duration-200"
                    >
                      <span className="inline-flex items-center gap-1">
                        {label}
                        {sortKey === key && (
                          <span className="text-primary">{sortDir === 'desc' ? '\u2193' : '\u2191'}</span>
                        )}
                      </span>
                    </th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {sorted.map((page, i) => (
                  <tr
                    key={page.page_id}
                    onClick={() => navigate(`/analytics/${page.page_id}`)}
                    className="hover:bg-surface-2/50 cursor-pointer transition-colors duration-200 group"
                  >
                    <td className="px-5 py-3.5 text-sm text-text-muted font-mono">{i + 1}</td>
                    <td className="px-5 py-3.5">
                      <div className="text-sm font-medium text-text">{page.title}</div>
                      <div className="text-xs text-text-muted font-mono mt-0.5">{page.domain ? `${page.domain}/` : '/'}{page.slug}</div>
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm font-semibold text-text tabular-nums">{fmt(page.pageviews)}</td>
                    <td className="px-5 py-3.5 text-right text-sm text-text-muted tabular-nums">{fmt(page.uniques)}</td>
                    <td className="px-5 py-3.5 text-right text-sm text-text-muted tabular-nums">{fmt(page.cta_clicks)}</td>
                    <td className="px-5 py-3.5 text-right text-sm text-text-muted tabular-nums">{fmtPct(page.cta_rate)}</td>
                    <td className="px-5 py-3.5 text-right text-sm font-medium">
                      <span className={`inline-flex items-center gap-1 ${
                        page.trend > 0 ? 'text-green-500' : page.trend < 0 ? 'text-red-400' : 'text-text-muted'
                      }`}>
                        {page.trend > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : page.trend < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                        {page.trend > 0 ? '+' : ''}{fmtPct(page.trend)}
                      </span>
                    </td>
                    <td className="pr-4 py-3.5">
                      <ArrowUpRight className="w-4 h-4 text-text-muted/0 group-hover:text-text-muted transition-all duration-200" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
