import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Globe, Copy, Languages, Trash2, Loader2, Check, Code } from 'lucide-react';
import GrapesEditor from '../editor/GrapesEditor';
import type { GrapesEditorRef } from '../editor/GrapesEditor';
import PublishModal from '../components/PublishModal';
import DuplicatePageModal from '../components/DuplicatePageModal';
import TranslatePageModal from '../components/TranslatePageModal';
import { useToast } from '../components/ui/Toast';

interface PageData {
  id: string;
  title: string;
  slug?: string;
  type?: string;
  status?: string;
  category_id?: string | null;
}

export default function EditorPage() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const editorRef = useRef<GrapesEditorRef>(null);
  const [page, setPage] = useState<PageData | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [showTranslate, setShowTranslate] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purged, setPurged] = useState(false);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [codeContent, setCodeContent] = useState('');
  const [codeSaving, setCodeSaving] = useState(false);

  useEffect(() => {
    if (!pageId) return;
    (async () => {
      try {
        const res = await fetch(`/api/pages/${pageId}`, { credentials: 'include' });
        if (res.ok) setPage(await res.json());
      } catch {
        // Page load failed
      }
    })();
  }, [pageId]);

  const handlePublishClick = async () => {
    try {
      await editorRef.current?.save();
    } catch {
      toast('Save falhou antes de publicar — usando último conteúdo salvo', 'warning');
    }
    setShowPublish(true);
  };

  const handleOpenCode = async () => {
    if (!pageId) return;
    try {
      const res = await fetch(`/api/pages/${pageId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCodeContent(data.html_content || '');
        setShowCodeEditor(true);
      }
    } catch {
      toast('Falha ao carregar código', 'error');
    }
  };

  const handleSaveCode = async () => {
    if (!pageId) return;
    setCodeSaving(true);
    try {
      const res = await fetch(`/api/pages/${pageId}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ html_content: codeContent }),
      });
      if (res.ok) {
        toast('Código salvo! Recarregue o editor para ver as mudanças.', 'success');
        setShowCodeEditor(false);
      } else {
        toast('Falha ao salvar código', 'error');
      }
    } catch {
      toast('Falha ao salvar código', 'error');
    } finally {
      setCodeSaving(false);
    }
  };

  const handlePurgeCache = async () => {
    if (!pageId || purging) return;
    setPurging(true);
    try {
      await fetch(`/api/pages/${pageId}/purge-cache`, { method: 'POST', credentials: 'include' });
      setPurged(true);
      setTimeout(() => setPurged(false), 2000);
    } catch {
      toast('Falha ao limpar cache', 'error');
    } finally {
      setPurging(false);
    }
  };

  if (!pageId) return null;

  return (
    <div className="flex flex-col h-screen bg-bg">
      {/* Minimal top bar */}
      <header className="h-[42px] bg-surface border-b border-border flex items-center px-4 gap-2 shrink-0 z-50">
        <button
          onClick={() => navigate(-1)}
          className="text-text-muted hover:text-text flex items-center p-1 rounded-md cursor-pointer transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
          title="Voltar"
          aria-label="Voltar"
        >
          <ArrowLeft size={16} />
        </button>

        <span className="text-sm font-medium text-text flex-1 truncate">
          {page?.title || 'Carregando...'}
        </span>

        <button
          onClick={handleOpenCode}
          className="text-text-muted hover:text-text border border-border hover:bg-surface-2 px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 cursor-pointer transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
          title="Editar Código HTML"
        >
          <Code size={13} />
          Código
        </button>

        <button
          onClick={() => setShowTranslate(true)}
          className="text-text-muted hover:text-text border border-border hover:bg-surface-2 px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 cursor-pointer transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
          title="Traduzir"
        >
          <Languages size={13} />
          Traduzir
        </button>

        <button
          onClick={() => setShowDuplicate(true)}
          className="text-text-muted hover:text-text border border-border hover:bg-surface-2 px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 cursor-pointer transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
          title="Duplicar"
        >
          <Copy size={13} />
          Duplicar
        </button>

        <button
          onClick={handlePurgeCache}
          disabled={purging}
          className={`border px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 cursor-pointer transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
            purged
              ? 'border-primary text-primary bg-primary/10'
              : 'border-border text-text-muted hover:text-text hover:bg-surface-2'
          }`}
          title="Limpar Cache CDN"
        >
          {purging ? (
            <Loader2 size={13} className="animate-spin" />
          ) : purged ? (
            <Check size={13} />
          ) : (
            <Trash2 size={13} />
          )}
          {purged ? 'Cache limpo!' : 'Limpar Cache'}
        </button>

        <button
          onClick={handlePublishClick}
          className="bg-primary text-bg hover:bg-primary/90 px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 cursor-pointer transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
          title="Publicar"
        >
          <Globe size={13} />
          Publicar
        </button>
      </header>

      {/* Studio Editor */}
      <div className="flex-1 overflow-hidden">
        <GrapesEditor ref={editorRef} pageId={pageId} onWarning={(msg) => toast(msg, 'warning')} />
      </div>

      {/* Publish Modal */}
      <PublishModal
        open={showPublish}
        onClose={() => setShowPublish(false)}
        pageId={pageId}
        pageType={page?.type || 'pv'}
        currentCategoryId={page?.category_id}
        currentSlug={page?.slug}
      />

      {/* Duplicate Modal */}
      <DuplicatePageModal
        open={showDuplicate}
        onClose={() => setShowDuplicate(false)}
        pageId={pageId}
        pageTitle={page?.title || ''}
      />

      {/* Translate Modal */}
      <TranslatePageModal
        open={showTranslate}
        onClose={() => setShowTranslate(false)}
        pageId={pageId}
        pageTitle={page?.title || ''}
      />

      {/* Code Editor Modal */}
      {showCodeEditor && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
          <div className="bg-surface rounded-lg shadow-2xl flex flex-col" style={{ width: '90vw', height: '90vh' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <span className="text-sm font-semibold text-text">Editar Código HTML</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveCode}
                  disabled={codeSaving}
                  className="bg-primary text-bg hover:bg-primary/90 px-4 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-colors"
                >
                  {codeSaving ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  onClick={() => setShowCodeEditor(false)}
                  className="text-text-muted hover:text-text px-3 py-1.5 rounded-md text-sm cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
            <textarea
              value={codeContent}
              onChange={(e) => setCodeContent(e.target.value)}
              className="flex-1 w-full p-4 font-mono text-xs bg-[#1e1e1e] text-[#d4d4d4] resize-none focus:outline-none"
              spellCheck={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}
