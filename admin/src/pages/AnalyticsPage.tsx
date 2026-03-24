import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, TrendingUp, TrendingDown, Minus, Eye, Users, MousePointerClick, Percent } from 'lucide-react';
import { useAnalytics } from '../hooks/useFetchAnalytics';

type SortKey = 'pageviews' | 'uniques' | 'cta_clicks' | 'cta_rate' | 'trend';
type SortDir = 'asc' | 'desc';

const fmt = (n: number) => n.toLocaleString('pt-BR');
const fmtPct = (n: number) => n.toFixed(1).replace('.', ',') + '%';

export default function AnalyticsPage() {
  const { data, loading, period, setPeriod } = useAnalytics();
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-800">Analytics</h1>
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

      {s && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Visitas', value: fmt(s.total_pageviews), icon: Eye },
            { label: 'Únicos', value: fmt(s.total_uniques), icon: Users },
            { label: 'Cliques CTA', value: fmt(s.total_cta_clicks), icon: MousePointerClick },
            { label: 'Taxa CTA', value: fmtPct(s.avg_cta_rate), icon: Percent },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <card.icon className="w-4 h-4" />
                {card.label}
              </div>
              <div className="text-2xl font-bold text-gray-800">{card.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : !sorted.length ? (
          <div className="p-8 text-center text-gray-400">Nenhum dado para o período</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">#</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Página</th>
                {([
                  ['pageviews', 'Visitas'],
                  ['uniques', 'Únicos'],
                  ['cta_clicks', 'Cliques CTA'],
                  ['cta_rate', 'Taxa CTA'],
                  ['trend', 'Tendência'],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <th
                    key={key}
                    onClick={() => toggleSort(key)}
                    className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3 cursor-pointer hover:text-gray-700 select-none"
                  >
                    {label} {sortKey === key ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((page, i) => (
                <tr
                  key={page.page_id}
                  onClick={() => navigate(`/analytics/${page.page_id}`)}
                  className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-800">{page.title}</div>
                    <div className="text-xs text-gray-400">{page.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-gray-800">{fmt(page.pageviews)}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">{fmt(page.uniques)}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">{fmt(page.cta_clicks)}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">{fmtPct(page.cta_rate)}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium">
                    <span className={page.trend > 0 ? 'text-green-600' : page.trend < 0 ? 'text-red-500' : 'text-gray-400'}>
                      {page.trend > 0 ? <TrendingUp className="w-4 h-4 inline mr-1" /> : page.trend < 0 ? <TrendingDown className="w-4 h-4 inline mr-1" /> : <Minus className="w-4 h-4 inline mr-1" />}
                      {page.trend > 0 ? '+' : ''}{fmtPct(page.trend)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
