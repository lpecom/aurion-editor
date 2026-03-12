import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Loader2, ExternalLink, ArrowLeft, Check } from 'lucide-react';
import { api } from '../lib/api';
import CopierPreview from '../components/CopierPreview';
import CopierChecklist from '../components/CopierChecklist';
import MiniPlayer from '../components/ui/MiniPlayer';

interface RemovedItem {
  id: string;
  category: string;
  description: string;
  html_original: string;
}

interface ScrapeResult {
  html: string;
  original_title: string;
  assets_downloaded: Array<{ original_url: string; local_path: string }>;
  removed_items: RemovedItem[];
  warnings: string[];
  scrape_method: string;
}

interface SavedPage {
  id: string;
  title: string;
  slug: string;
  type: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type PageState = 'input' | 'loading' | 'preview' | 'saving' | 'success';

export default function Copier() {
  const navigate = useNavigate();

  // State: input
  const [url, setUrl] = useState('');

  // State: loading
  const [loadingMessage, setLoadingMessage] = useState('');

  // State: preview
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);
  const [disabledItems, setDisabledItems] = useState<Set<string>>(new Set());
  const [checkoutReplacements, setCheckoutReplacements] = useState<Map<string, string>>(new Map());
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [pageType, setPageType] = useState<'pv' | 'advertorial'>('pv');

  // State: success
  const [savedPage, setSavedPage] = useState<SavedPage | null>(null);

  // State: error
  const [error, setError] = useState('');

  // Current state
  const [pageState, setPageState] = useState<PageState>('input');
  const [showPlayer, setShowPlayer] = useState(false);

  // Slug check
  const [slugError, setSlugError] = useState('');

  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle);
    if (!slugManual) {
      setSlug(slugify(newTitle));
      setSlugError('');
    }
  }, [slugManual]);

  const handleSlugChange = useCallback((newSlug: string) => {
    setSlugManual(true);
    setSlug(newSlug);
    setSlugError('');
  }, []);

  async function handleScrape(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setError('');
    setPageState('loading');
    setLoadingMessage('Baixando página...');
    setShowPlayer(true);

    try {
      setLoadingMessage('Scraping e processando...');
      const result = await api.post<ScrapeResult>('/copier/scrape', { url: url.trim() });

      setScrapeResult(result);
      setTitle(result.original_title || '');
      setSlug(slugify(result.original_title || ''));
      setSlugManual(false);
      setDisabledItems(new Set());
      setCheckoutReplacements(new Map());
      setPageState('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao clonar página');
      setPageState('input');
    }
  }

  /**
   * Build the HTML reflecting the user's checklist choices.
   * @param forPreview - if true, keeps absolute asset URLs for iframe rendering.
   *                     if false, converts to relative paths for saving.
   */
  function buildFinalHtml(forPreview: boolean): string {
    if (!scrapeResult) return '';
    let html = scrapeResult.html;

    // Restore items that the user un-checked (disabledItems)
    const restoredScripts: string[] = [];
    const restoredHead: string[] = [];

    for (const item of scrapeResult.removed_items) {
      if (!disabledItems.has(item.id)) continue; // Still removed, skip

      if (item.category === 'verification') {
        restoredHead.push(item.html_original);
      } else if (item.category === 'checkout') {
        // Checkout links are still in the HTML with href="#", skip restore
      } else {
        restoredScripts.push(item.html_original);
      }
    }

    if (restoredHead.length > 0) {
      html = html.replace('</head>', restoredHead.join('\n') + '\n</head>');
    }
    if (restoredScripts.length > 0) {
      html = html.replace('</body>', restoredScripts.join('\n') + '\n</body>');
    }

    // Apply checkout link replacements using data-copier-id for targeted matching
    for (const [itemId, newUrl] of checkoutReplacements) {
      if (!newUrl.trim()) continue;
      // Replace href="#" with new URL for the specific element with data-copier-id
      html = html.replace(
        new RegExp(`href="#"([^>]*data-copier-id="${itemId}")`, 'g'),
        `href="${newUrl}"$1`
      );
    }

    if (!forPreview) {
      // Convert absolute asset URLs back to relative for saving
      html = html.replace(/https?:\/\/[^/]+\/(assets\/imgs\/[^"'\s)]+)/g, '/$1');
      // Clean up data-copier-id attributes
      html = html.replace(/\s*data-copier-id="[^"]*"/g, '');
    }

    return html;
  }

  async function handleSave() {
    if (!title.trim() || !slug.trim()) return;

    setError('');
    setSlugError('');
    setPageState('saving');

    try {
      const finalHtml = buildFinalHtml(false);
      const result = await api.post<{ page: SavedPage }>('/copier/save', {
        html: finalHtml,
        title: title.trim(),
        slug: slug.trim(),
        type: pageType,
      });
      setSavedPage(result.page);
      setPageState('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar página';
      if (message.includes('409') || message.toLowerCase().includes('slug')) {
        setSlugError('Slug já existe. Escolha outro.');
        setPageState('preview');
      } else {
        setError(message);
        setPageState('preview');
      }
    }
  }

  // Reactive preview HTML that reflects checklist toggles
  const previewHtml = useMemo(() => buildFinalHtml(true), [scrapeResult, disabledItems, checkoutReplacements]);

  function handleReset() {
    setUrl('');
    setScrapeResult(null);
    setDisabledItems(new Set());
    setCheckoutReplacements(new Map());
    setTitle('');
    setSlug('');
    setSlugManual(false);
    setSavedPage(null);
    setError('');
    setSlugError('');
    setPageState('input');
  }

  // === RENDER ===

  const player = showPlayer ? (
    <MiniPlayer
      title="Love Sosa"
      artist="Chief Keef"
      src="/love-sosa.mp3"
    />
  ) : null;

  if (pageState === 'input' || pageState === 'loading') {
    return (
      <div className="max-w-xl mx-auto py-16 px-4">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Copy className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-text">Copier</h1>
          <p className="text-text-muted mt-2">Clone qualquer página da web para editar no Aurion</p>
        </div>

        <form onSubmit={handleScrape} className="space-y-4">
          {error && (
            <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1.5">URL da página</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://exemplo.com/landing-page"
              className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-text text-sm placeholder:text-text-muted/50 focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
              disabled={pageState === 'loading'}
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            disabled={pageState === 'loading' || !url.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md bg-primary text-bg hover:bg-primary/90 cursor-pointer transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pageState === 'loading' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {loadingMessage}
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Clonar página
              </>
            )}
          </button>
        </form>
        {player}
      </div>
    );
  }

  if ((pageState === 'preview' || pageState === 'saving') && scrapeResult) {
    return (
      <div className="flex flex-col h-full">
        {/* Top bar */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-surface shrink-0">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-sm text-text-muted hover:text-text cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>

          <div className="flex-1 flex items-center gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Título da página"
              className="flex-1 max-w-xs bg-surface-2 border border-border rounded-md px-2 py-1.5 text-text text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none"
            />
            <div className="flex items-center gap-1">
              <span className="text-text-muted text-sm">/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="slug"
                className={`w-40 bg-surface-2 border rounded-md px-2 py-1.5 text-text text-sm font-mono focus:ring-2 focus:ring-primary/50 focus:outline-none ${
                  slugError ? 'border-danger' : 'border-border'
                }`}
              />
            </div>
            <select
              value={pageType}
              onChange={(e) => setPageType(e.target.value as 'pv' | 'advertorial')}
              className="bg-surface-2 border border-border rounded-md px-2 py-1.5 text-text text-sm cursor-pointer focus:ring-2 focus:ring-primary/50 focus:outline-none"
            >
              <option value="pv">Página de Venda</option>
              <option value="advertorial">Advertorial</option>
            </select>
          </div>

          <button
            onClick={handleSave}
            disabled={pageState === 'saving' || !title.trim() || !slug.trim()}
            className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md bg-primary text-bg hover:bg-primary/90 cursor-pointer transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pageState === 'saving' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar página'
            )}
          </button>
        </div>

        {slugError && (
          <div className="px-4 py-2 text-sm text-danger bg-danger/10 border-b border-danger/20">
            {slugError}
          </div>
        )}

        {error && (
          <div className="px-4 py-2 text-sm text-danger bg-danger/10 border-b border-danger/20">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Preview */}
          <div className="flex-1 p-4">
            <CopierPreview html={previewHtml} />
          </div>

          {/* Checklist sidebar */}
          <div className="w-80 border-l border-border p-4 overflow-y-auto bg-surface shrink-0">
            <h3 className="text-sm font-semibold text-text mb-3">Itens Removidos</h3>
            <CopierChecklist
              removedItems={scrapeResult.removed_items}
              disabledItems={disabledItems}
              onToggleItem={(id) => {
                setDisabledItems(prev => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                });
              }}
              checkoutReplacements={checkoutReplacements}
              onCheckoutReplace={(id, newUrl) => {
                setCheckoutReplacements(prev => {
                  const next = new Map(prev);
                  next.set(id, newUrl);
                  return next;
                });
              }}
            />

            {scrapeResult.warnings.length > 0 && (
              <div className="mt-4 space-y-1">
                <h4 className="text-xs font-medium text-text-muted">Avisos</h4>
                {scrapeResult.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-text-muted/70">{w}</p>
                ))}
              </div>
            )}
          </div>
        </div>
        {player}
      </div>
    );
  }

  if (pageState === 'success' && savedPage) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Check className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-text mb-2">Página clonada com sucesso!</h2>
        <p className="text-text-muted mb-6">
          "{savedPage.title}" foi salva como rascunho.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm font-medium rounded-md border border-border text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-colors duration-200"
          >
            Clonar outra
          </button>
          <button
            onClick={() => navigate(`/editor/${savedPage.id}`)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-bg hover:bg-primary/90 cursor-pointer transition-colors duration-200"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir no editor
          </button>
        </div>
        {player}
      </div>
    );
  }

  return null;
}
