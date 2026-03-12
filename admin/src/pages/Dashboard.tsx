import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Newspaper, Globe, FileEdit, Plus, ArrowRight, Inbox } from 'lucide-react';
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
  value: number;
  icon: React.ReactNode;
  color: string;
  gradient: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [pvPages, setPvPages] = useState<Page[]>([]);
  const [advPages, setAdvPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [pv, adv] = await Promise.all([
          api.get<Page[]>('/pages?type=pv'),
          api.get<Page[]>('/pages?type=advertorial'),
        ]);
        setPvPages(pv);
        setAdvPages(adv);
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

  return (
    <div className="animate-fade-in">
      {/* Section Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">Visão Geral</h1>
        <p className="text-sm text-text-muted mt-1">Acompanhe suas páginas e métricas do painel.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
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

      {/* Recent Pages */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-text mb-1">Últimas editadas</h2>
        <p className="text-sm text-text-muted mb-4">Páginas atualizadas recentemente.</p>
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
            <p className="text-text-muted font-medium">Nenhuma página criada ainda.</p>
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

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-text mb-1">Ações rápidas</h2>
        <p className="text-sm text-text-muted mb-4">Crie novas páginas rapidamente.</p>
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
