import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Languages, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { api } from '../lib/api';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';

interface Translation {
  id: string;
  title: string;
  slug: string;
  lang: string;
  status: string;
  source_page_id: string;
  source_title?: string;
  created_at: string;
}

interface Language {
  id: string;
  code: string;
  name: string;
  flag: string | null;
}

type ViewMode = 'lang' | 'source';

export default function Translations() {
  const navigate = useNavigate();
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('lang');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [t, l] = await Promise.all([
          api.get<Translation[]>('/translations'),
          api.get<Language[]>('/languages'),
        ]);
        setTranslations(t);
        setLanguages(l);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const langMap = useMemo(() => {
    const map: Record<string, Language> = {};
    languages.forEach((l) => { map[l.code] = l; });
    return map;
  }, [languages]);

  const byLanguage = useMemo(() => {
    const groups: Record<string, Translation[]> = {};
    translations.forEach((t) => {
      if (!groups[t.lang]) groups[t.lang] = [];
      groups[t.lang].push(t);
    });
    return groups;
  }, [translations]);

  const bySource = useMemo(() => {
    const groups: Record<string, { sourceTitle: string; translations: Translation[] }> = {};
    translations.forEach((t) => {
      const key = t.source_page_id;
      if (!groups[key]) groups[key] = { sourceTitle: t.source_title || 'Página original', translations: [] };
      groups[key].translations.push(t);
    });
    return groups;
  }, [translations]);

  function toggleExpand(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-accent/10 p-2.5">
            <Languages className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">Traduções</h1>
            <p className="text-sm text-text-muted">Gerencie as traduções das suas páginas.</p>
          </div>
        </div>

        {/* Toggle */}
        <div className="flex items-center bg-surface-2 border border-border rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('lang')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md cursor-pointer transition-all duration-200 ${
              viewMode === 'lang'
                ? 'bg-primary text-bg'
                : 'text-text-muted hover:text-text'
            }`}
          >
            Por Idioma
          </button>
          <button
            onClick={() => setViewMode('source')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md cursor-pointer transition-all duration-200 ${
              viewMode === 'source'
                ? 'bg-primary text-bg'
                : 'text-text-muted hover:text-text'
            }`}
          >
            Por Página Original
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-lg p-5 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-5 w-8 bg-surface-2 rounded" />
                <div className="h-5 w-40 bg-surface-2 rounded" />
                <div className="h-5 w-12 bg-surface-2 rounded-full ml-auto" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && translations.length === 0 && (
        <EmptyState
          icon={Languages}
          title="Nenhuma tradução criada"
          description="Traduza uma página para começar."
        />
      )}

      {/* By Language view */}
      {!loading && translations.length > 0 && viewMode === 'lang' && (
        <div className="space-y-3">
          {Object.entries(byLanguage).map(([langCode, items]) => {
            const lang = langMap[langCode];
            const isOpen = expanded.has(langCode);
            return (
              <div key={langCode} className="bg-surface border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleExpand(langCode)}
                  className="w-full flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-surface-2/50 transition-colors duration-200"
                >
                  {isOpen ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
                  <span className="text-lg">{lang?.flag || ''}</span>
                  <span className="text-sm font-medium text-text">{lang?.name || langCode}</span>
                  <Badge>{items.length} {items.length === 1 ? 'tradução' : 'traduções'}</Badge>
                </button>
                {isOpen && (
                  <div className="border-t border-border divide-y divide-border">
                    {items.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => navigate(`/editor/${t.id}`)}
                        className="w-full flex items-center gap-4 px-5 py-3 hover:bg-surface-2/50 cursor-pointer transition-colors duration-200 text-left"
                      >
                        <Pencil className="w-3.5 h-3.5 text-text-muted shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text truncate">{t.title}</p>
                          <p className="text-xs text-text-muted font-mono">/{t.slug}</p>
                        </div>
                        <Badge variant={t.status === 'published' ? 'success' : 'warning'} dot>
                          {t.status === 'published' ? 'Publicada' : 'Rascunho'}
                        </Badge>
                        <span className="text-xs text-text-muted">{formatDate(t.created_at)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* By Source view */}
      {!loading && translations.length > 0 && viewMode === 'source' && (
        <div className="space-y-3">
          {Object.entries(bySource).map(([sourceId, group]) => {
            const isOpen = expanded.has(sourceId);
            return (
              <div key={sourceId} className="bg-surface border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleExpand(sourceId)}
                  className="w-full flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-surface-2/50 transition-colors duration-200"
                >
                  {isOpen ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
                  <span className="text-sm font-medium text-text">{group.sourceTitle}</span>
                  <Badge>{group.translations.length} {group.translations.length === 1 ? 'tradução' : 'traduções'}</Badge>
                </button>
                {isOpen && (
                  <div className="border-t border-border divide-y divide-border">
                    {group.translations.map((t) => {
                      const lang = langMap[t.lang];
                      return (
                        <button
                          key={t.id}
                          onClick={() => navigate(`/editor/${t.id}`)}
                          className="w-full flex items-center gap-4 px-5 py-3 hover:bg-surface-2/50 cursor-pointer transition-colors duration-200 text-left"
                        >
                          <span className="text-lg shrink-0">{lang?.flag || ''}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text truncate">{t.title}</p>
                            <p className="text-xs text-text-muted">{lang?.name || t.lang}</p>
                          </div>
                          <Badge variant={t.status === 'published' ? 'success' : 'warning'} dot>
                            {t.status === 'published' ? 'Publicada' : 'Rascunho'}
                          </Badge>
                          <span className="text-xs text-text-muted">{formatDate(t.created_at)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
