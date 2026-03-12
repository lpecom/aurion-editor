import { useState, useEffect } from 'react';
import { Folder, FolderOpen, ChevronRight, LayoutGrid } from 'lucide-react';
import { api } from '../lib/api';

interface Page {
  id: string;
  title: string;
  slug: string;
  type: string;
}

interface ResourceFolderNavProps {
  selectedPageId: string | null;
  onSelectPage: (pageId: string | null) => void;
}

export default function ResourceFolderNav({ selectedPageId, onSelectPage }: ResourceFolderNavProps) {
  const [pages, setPages] = useState<Page[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ pv: true, advertorial: true });

  useEffect(() => {
    api.get<Page[]>('/pages').then(setPages).catch(() => {});
  }, []);

  const pvPages = pages.filter((p) => p.type === 'pv');
  const advPages = pages.filter((p) => p.type === 'advertorial');
  const auxPages = pages.filter((p) => p.type === 'auxiliar');

  const groups = [
    { key: 'pv', label: 'Páginas de Venda', pages: pvPages },
    { key: 'advertorial', label: 'Advertoriais', pages: advPages },
    ...(auxPages.length > 0 ? [{ key: 'auxiliar', label: 'Auxiliares', pages: auxPages }] : []),
  ];

  return (
    <div className="w-56 border-r border-border/50 bg-surface/50 shrink-0 overflow-y-auto">
      <div className="p-3">
        <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-2 px-2">Projetos</h4>

        {/* All items */}
        <button
          onClick={() => onSelectPage(null)}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm cursor-pointer transition-all duration-200 mb-1 ${
            selectedPageId === null
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-zinc-400 hover:text-text hover:bg-surface-2/50'
          }`}
        >
          <LayoutGrid className="w-4 h-4 shrink-0" />
          <span>Todos</span>
        </button>

        {/* Page groups */}
        {groups.map((group) => (
          <div key={group.key} className="mt-2">
            <button
              onClick={() => setExpanded((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
              className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider hover:text-zinc-400 cursor-pointer transition-colors"
            >
              <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${expanded[group.key] ? 'rotate-90' : ''}`} />
              {group.label}
            </button>
            {expanded[group.key] && (
              <div className="mt-0.5 space-y-0.5">
                {group.pages.length === 0 ? (
                  <p className="text-[11px] text-zinc-600 px-2.5 py-1.5 pl-7">Nenhuma página</p>
                ) : (
                  group.pages.map((page) => (
                    <button
                      key={page.id}
                      onClick={() => onSelectPage(page.id)}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 pl-5 rounded-lg text-sm cursor-pointer transition-all duration-200 ${
                        selectedPageId === page.id
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-zinc-400 hover:text-text hover:bg-surface-2/50'
                      }`}
                      title={`/${page.slug}`}
                    >
                      {selectedPageId === page.id ? (
                        <FolderOpen className="w-4 h-4 shrink-0" />
                      ) : (
                        <Folder className="w-4 h-4 shrink-0" />
                      )}
                      <span className="truncate">{page.title}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
