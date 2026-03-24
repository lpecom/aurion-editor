import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Newspaper, Globe, FileEdit, Plus, ArrowRight, Inbox, Eye, MousePointerClick, TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';
import { api } from '../lib/api';

interface Page {
  id: string;
  title: string;
  slug: string;
  type: string;
  status: string;
  updated_at: string;
}

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  gradient: string;
}

interface AnalyticsSummary {
  total_pageviews: number;
  total_uniques: number;
  total_cta_clicks: number;
  avg_cta_rate: number;
}

interface AnalyticsPage {
  page_id: string;
  title: string;
  slug: string;
  pageviews: number;
  uniques: number;
  cta_clicks: number;
  cta_rate: number;
  trend: number;
}

interface AnalyticsData {
  summary: AnalyticsSummary;
  pages: AnalyticsPage[];
}

const fmt = (n: number) => n.toLocaleString('pt-BR');
const fmtPct = (n: number) => n.toFixed(1).replace('.', ',') + '%';

export default function Dashboard() {
  const navigate = useNavigate();
  const [pvPages, setPvPages] = useState<Page[]>([]);
  const [advPages, setAdvPages] = useState<Page[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [pv, adv, analyticsData] = await Promise.all([
          api.get<Page[]>('/pages?type=pv'),
          api.get<Page[]>('/pages?type=advertorial'),
          api.get<AnalyticsData>('/analytics?period=7d').catch(() => null),
        ]);
        setPvPages(pv);
        setAdvPages(adv);
        setAnalytics(analyticsData);
      } catch {
        // silently fail, cards show 0
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const allPages = [...pvPages, ...advPages];
  const publishedCount = allPages.filter((p) => p.status === 'published').length;
  const draftCount = allPages.filter((p) => p.status === 'draft').length;

  const recentPages = [...allPages]
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
    .slice(0, 5);

  const cards: StatCard[] = [
    { label: 'Total PVs', value: pvPages.length, icon: <FileText className="w-5 h-5" />, color: 'text-primary', gradient: 'from-primary/10 to-transparent' },
    { label: 'Total Advertoriais', value: advPages.length, icon: <Newspaper className="w-5 h-5" />, color: 'text-accent', gradient: 'from-accent/10 to-transparent' },
    { label: 'Publicadas', value: publishedCount, icon: <Globe className="w-5 h-5" />, color: 'text-primary', gradient: 'from-primary/10 to-transparent' },
    { label: 'Rascunhos', value: draftCount, icon: <FileEdit className="w-5 h-5" />, color: 'text-warning', gradient: 'from-warning/10 to-transparent' },
  ];

  const topPages = analytics?.pages?.slice(0, 5) || [];

  return (
    <div className="animate-fade-in">
      {/* Section Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">Visao Geral</h1>
        <p className="text-sm text-text-muted mt-1">Acompanhe suas paginas e metricas do painel.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-surface border border-border/50 rounded-2xl p-5 flex items-center gap-4 hover:border-border-hover transition-all duration-200 relative overflow-hidden card-hover"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} pointer-events-none`} />
            <div className={`relative w-11 h-11 rounded-xl bg-surface-2/80 flex items-center justify-center ${card.color}`}>
              {card.icon}
            </div>
            <div className="relative">
              <p className="text-2xl font-bold text-text">
                {loading ? (
                  <span className="inline-block h-7 w-10 rounded animate-shimmer" />
                ) : (
                  card.value
                )}
              </p>
              <p className="text-sm text-text-muted">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Analytics Overview + Recent Pages — side by side on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        {/* Analytics Mini Dashboard */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold text-text">Trafego (7 dias)</h2>
            <button
              onClick={() => navigate('/analytics')}
              className="text-xs text-primary font-medium hover:text-primary/80 cursor-pointer transition-colors duration-200 flex items-center gap-1"
            >
              Ver tudo <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <p className="text-sm text-text-muted mb-4">Visitas e conversoes recentes.</p>

          {loading ? (
            <div className="bg-surface border border-border/50 rounded-2xl p-5">
              <div className="grid grid-cols-3 gap-4 mb-5">
                {[...Array(3)].map((_, i) => (
                  <div key={i}>
                    <div className="h-4 w-16 rounded animate-shimmer mb-1" />
                    <div className="h-6 w-12 rounded animate-shimmer" />
                  </div>
                ))}
              </div>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5">
                  <div className="h-4 w-40 rounded animate-shimmer" />
                  <div className="ml-auto h-4 w-14 rounded animate-shimmer" />
                </div>
              ))}
            </div>
          ) : !analytics ? (
            <div className="bg-surface border border-border/50 rounded-2xl p-8 text-center">
              <BarChart3 className="w-8 h-8 text-text-muted/40 mx-auto mb-2" />
              <p className="text-text-muted text-sm">Sem dados de trafego ainda.</p>
            </div>
          ) : (
            <div className="bg-surface border border-border/50 rounded-2xl p-5">
              {/* Mini stats */}
              <div className="grid grid-cols-3 gap-4 mb-5 pb-5 border-b border-border/30">
                <div>
                  <p className="text-xs text-text-muted flex items-center gap-1"><Eye className="w-3 h-3" /> Visitas</p>
                  <p className="text-lg font-bold text-text mt-0.5">{fmt(analytics.summary.total_pageviews)}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted flex items-center gap-1"><MousePointerClick className="w-3 h-3" /> Cliques</p>
                  <p className="text-lg font-bold text-text mt-0.5">{fmt(analytics.summary.total_cta_clicks)}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Taxa CTA</p>
                  <p className="text-lg font-bold text-text mt-0.5">{fmtPct(analytics.summary.avg_cta_rate)}</p>
                </div>
              </div>

              {/* Top pages mini table */}
              {topPages.length > 0 ? (
                <div className="space-y-0 divide-y divide-border/30">
                  {topPages.map((page) => (
                    <button
                      key={page.page_id}
                      onClick={() => navigate(`/analytics/${page.page_id}`)}
                      className="w-full flex items-center gap-3 py-2.5 hover:bg-surface-2/50 cursor-pointer transition-colors duration-200 text-left -mx-2 px-2 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text font-medium truncate">{page.title}</p>
                      </div>
                      <span className="text-xs text-text-muted tabular-nums flex-shrink-0">{fmt(page.pageviews)} vis</span>
                      <span className={`text-xs font-medium flex-shrink-0 inline-flex items-center gap-0.5 ${
                        page.trend > 0 ? 'text-green-500' : page.trend < 0 ? 'text-red-400' : 'text-text-muted'
                      }`}>
                        {page.trend > 0 ? <TrendingUp className="w-3 h-3" /> : page.trend < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                        {page.trend > 0 ? '+' : ''}{fmtPct(page.trend)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted text-center py-2">Nenhuma pagina com trafego.</p>
              )}
            </div>
          )}
        </div>

        {/* Recent Pages */}
        <div>
          <h2 className="text-lg font-semibold text-text mb-1">Ultimas editadas</h2>
          <p className="text-sm text-text-muted mb-4">Paginas atualizadas recentemente.</p>
          {loading ? (
            <div className="bg-surface border border-border/50 rounded-2xl divide-y divide-border/50 overflow-hidden">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3">
                  <div className="h-4 w-48 rounded animate-shimmer" />
                  <div className="ml-auto h-4 w-16 rounded animate-shimmer" />
                </div>
              ))}
            </div>
          ) : recentPages.length === 0 ? (
            <div className="bg-surface border border-border/50 rounded-2xl p-10 text-center">
              <Inbox className="w-10 h-10 text-text-muted/40 mx-auto mb-3" />
              <p className="text-text-muted font-medium">Nenhuma pagina criada ainda.</p>
              <p className="text-text-muted/60 text-sm mt-1">Comece criando uma PV ou Advertorial.</p>
            </div>
          ) : (
            <div className="bg-surface border border-border/50 rounded-2xl divide-y divide-border/50 overflow-hidden">
              {recentPages.map((page) => (
                <button
                  key={page.id}
                  onClick={() => navigate(`/editor/${page.id}`)}
                  className="w-full flex items-center gap-4 px-5 py-3 hover:bg-surface-2/50 hover:border-primary/20 cursor-pointer transition-colors duration-200 text-left"
                >
                  {page.type === 'pv' ? (
                    <FileText className="w-4 h-4 text-text-muted shrink-0" />
                  ) : (
                    <Newspaper className="w-4 h-4 text-text-muted shrink-0" />
                  )}
                  <span className="text-sm font-medium text-text truncate">{page.title}</span>
                  <span className="text-xs text-text-muted font-mono ml-1">/{page.slug}</span>
                  <span
                    className={`ml-auto shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                      page.status === 'published'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-warning/10 text-warning'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      page.status === 'published' ? 'bg-primary' : 'bg-warning'
                    }`} />
                    {page.status === 'published' ? 'Publicada' : 'Rascunho'}
                  </span>
                  <ArrowRight className="w-4 h-4 text-text-muted shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-text mb-1">Acoes rapidas</h2>
        <p className="text-sm text-text-muted mb-4">Crie novas paginas rapidamente.</p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/paginas-de-venda')}
            className="flex items-center gap-2 bg-primary text-bg font-medium rounded-xl px-4 py-2 cursor-pointer hover:bg-primary/90 transition-colors duration-200"
          >
            <Plus className="w-4 h-4" />
            Nova PV
          </button>
          <button
            onClick={() => navigate('/advertoriais')}
            className="flex items-center gap-2 bg-accent text-white font-medium rounded-xl px-4 py-2 cursor-pointer hover:bg-accent/90 transition-colors duration-200"
          >
            <Plus className="w-4 h-4" />
            Novo Advertorial
          </button>
        </div>
      </div>
    </div>
  );
}
