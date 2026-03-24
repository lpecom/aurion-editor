import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Monitor, Smartphone, Tablet, Eye, Users, MousePointerClick, Percent } from 'lucide-react';
import { usePageAnalytics } from '../hooks/useFetchAnalytics';
import AnalyticsChart from '../components/AnalyticsChart';

const fmt = (n: number) => n.toLocaleString('pt-BR');
const fmtPct = (n: number) => n.toFixed(1).replace('.', ',') + '%';

export default function AnalyticsDetail() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const { data, loading, period, setPeriod } = usePageAnalytics(pageId!, '7d');

  const periods = [
    { value: 'today' as const, label: 'Hoje' },
    { value: '7d' as const, label: '7 dias' },
    { value: '30d' as const, label: '30 dias' },
  ];

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-5 w-5 rounded animate-shimmer" />
          <div className="h-6 w-64 rounded animate-shimmer" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-surface border border-border/50 rounded-2xl p-5">
              <div className="h-4 w-20 rounded animate-shimmer mb-2" />
              <div className="h-7 w-16 rounded animate-shimmer" />
            </div>
          ))}
        </div>
        <div className="bg-surface border border-border/50 rounded-2xl p-6 h-56 animate-shimmer" />
      </div>
    );
  }
  if (!data) return <div className="p-8 text-center text-text-muted">Pagina nao encontrada</div>;

  const chartData = data.daily.map(d => ({
    label: d.date.slice(5),
    values: [d.pageviews, d.cta_clicks],
  }));

  const totalDevices = Object.values(data.devices).reduce((s, v) => s + v, 0) || 1;
  const deviceIcon = { mobile: Smartphone, desktop: Monitor, tablet: Tablet } as const;
  const deviceLabel = { mobile: 'Mobile', desktop: 'Desktop', tablet: 'Tablet' } as const;
  const deviceColors = { mobile: 'bg-primary', desktop: 'bg-accent', tablet: 'bg-warning' } as const;

  const statCards = [
    { label: 'Visitas', value: fmt(data.summary.pageviews), icon: <Eye className="w-5 h-5" />, color: 'text-primary', gradient: 'from-primary/10 to-transparent' },
    { label: 'Visitantes', value: fmt(data.summary.uniques), icon: <Users className="w-5 h-5" />, color: 'text-accent', gradient: 'from-accent/10 to-transparent' },
    { label: 'Cliques CTA', value: fmt(data.summary.cta_clicks), icon: <MousePointerClick className="w-5 h-5" />, color: 'text-primary', gradient: 'from-primary/10 to-transparent' },
    { label: 'Taxa CTA', value: fmtPct(data.summary.cta_rate), icon: <Percent className="w-5 h-5" />, color: 'text-warning', gradient: 'from-warning/10 to-transparent' },
  ];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/analytics')}
            className="p-1.5 hover:bg-surface-2 rounded-lg cursor-pointer transition-colors duration-200"
          >
            <ArrowLeft className="w-5 h-5 text-text-muted" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-text">{data.title}</h1>
            <p className="text-xs text-text-muted font-mono">/{data.page_id}</p>
          </div>
        </div>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(card => (
          <div
            key={card.label}
            className="bg-surface border border-border/50 rounded-2xl p-5 flex items-center gap-4 relative overflow-hidden"
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

      {/* Chart */}
      <div className="bg-surface border border-border/50 rounded-2xl p-5 mb-8">
        <h2 className="text-sm font-semibold text-text mb-4">Visitas por dia</h2>
        <AnalyticsChart
          data={chartData}
          series={[
            { name: 'Visitas', color: 'var(--color-primary, #3b82f6)' },
            { name: 'Cliques CTA', color: 'var(--color-accent, #ef4444)' },
          ]}
          height={220}
        />
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Referrers */}
        <div className="bg-surface border border-border/50 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-text mb-4">Top Referrers</h2>
          {data.referrers.length ? (
            <div className="space-y-3">
              {data.referrers.map((r, i) => {
                const maxCount = data.referrers[0]?.count || 1;
                const pct = (r.count / maxCount) * 100;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-text truncate mr-2">{r.referrer}</span>
                      <span className="text-text font-semibold flex-shrink-0 tabular-nums">{fmt(r.count)}</span>
                    </div>
                    <div className="w-full bg-surface-2 rounded-full h-1">
                      <div className="bg-primary/60 rounded-full h-1 transition-all duration-300" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-text-muted">Sem dados de referrer</p>
          )}
        </div>

        {/* Devices */}
        <div className="bg-surface border border-border/50 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-text mb-4">Dispositivos</h2>
          <div className="space-y-4">
            {(['mobile', 'desktop', 'tablet'] as const).map(d => {
              const count = data.devices[d] || 0;
              const pct = (count / totalDevices) * 100;
              const Icon = deviceIcon[d];
              return (
                <div key={d} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2 text-text">
                      <Icon className="w-4 h-4 text-text-muted" />
                      {deviceLabel[d]}
                    </span>
                    <span className="text-text font-semibold tabular-nums">{fmt(count)} <span className="text-text-muted font-normal">({fmtPct(pct)})</span></span>
                  </div>
                  <div className="w-full bg-surface-2 rounded-full h-1.5">
                    <div className={`${deviceColors[d]} rounded-full h-1.5 transition-all duration-300`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* UTMs */}
        <div className="bg-surface border border-border/50 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-text mb-4">Campanhas (UTM)</h2>
          {data.utms.length ? (
            <div className="space-y-3">
              {data.utms.map((u, i) => {
                const maxCount = data.utms[0]?.count || 1;
                const pct = (u.count / maxCount) * 100;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-text truncate mr-2">{[u.source, u.medium, u.campaign].filter(Boolean).join(' / ')}</span>
                      <span className="text-text font-semibold flex-shrink-0 tabular-nums">{fmt(u.count)}</span>
                    </div>
                    <div className="w-full bg-surface-2 rounded-full h-1">
                      <div className="bg-accent/60 rounded-full h-1 transition-all duration-300" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-text-muted">Sem dados de UTM</p>
          )}
        </div>
      </div>
    </div>
  );
}
