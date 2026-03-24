import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Monitor, Smartphone, Tablet } from 'lucide-react';
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

  if (loading) return <div className="p-8 text-center text-gray-400">Carregando...</div>;
  if (!data) return <div className="p-8 text-center text-gray-400">Página não encontrada</div>;

  const chartData = data.daily.map(d => ({
    label: d.date.slice(5),
    values: [d.pageviews, d.cta_clicks],
  }));

  const totalDevices = Object.values(data.devices).reduce((s, v) => s + v, 0) || 1;
  const deviceIcon = { mobile: Smartphone, desktop: Monitor, tablet: Tablet } as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/analytics')} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <h1 className="text-xl font-bold text-gray-800">{data.title}</h1>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {periods.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === p.value ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Visitas', value: fmt(data.summary.pageviews) },
          { label: 'Únicos', value: fmt(data.summary.uniques) },
          { label: 'Cliques CTA', value: fmt(data.summary.cta_clicks) },
          { label: 'Taxa CTA', value: fmtPct(data.summary.cta_rate) },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-500 mb-1">{c.label}</div>
            <div className="text-2xl font-bold text-gray-800">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-4">Visitas por dia</h2>
        <AnalyticsChart
          data={chartData}
          series={[
            { name: 'Visitas', color: '#3b82f6' },
            { name: 'Cliques CTA', color: '#ef4444' },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Top Referrers</h2>
          {data.referrers.length ? (
            <div className="space-y-2">
              {data.referrers.map((r, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-600 truncate mr-2">{r.referrer}</span>
                  <span className="text-gray-800 font-medium flex-shrink-0">{fmt(r.count)}</span>
                </div>
              ))}
            </div>
          ) : <div className="text-sm text-gray-400">Sem dados</div>}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Dispositivos</h2>
          <div className="space-y-3">
            {(['mobile', 'desktop', 'tablet'] as const).map(d => {
              const count = data.devices[d] || 0;
              const pct = (count / totalDevices) * 100;
              const Icon = deviceIcon[d];
              return (
                <div key={d} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-gray-600">
                      <Icon className="w-4 h-4" />
                      {d === 'mobile' ? 'Mobile' : d === 'desktop' ? 'Desktop' : 'Tablet'}
                    </span>
                    <span className="text-gray-800 font-medium">{fmt(count)} ({fmtPct(pct)})</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="bg-blue-500 rounded-full h-1.5 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">UTMs</h2>
          {data.utms.length ? (
            <div className="space-y-2">
              {data.utms.map((u, i) => (
                <div key={i} className="text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 truncate mr-2">{[u.source, u.medium, u.campaign].filter(Boolean).join(' / ')}</span>
                    <span className="text-gray-800 font-medium flex-shrink-0">{fmt(u.count)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="text-sm text-gray-400">Sem UTMs</div>}
        </div>
      </div>
    </div>
  );
}
