import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, FileText, Newspaper, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';

interface CreatePageModalProps {
  open: boolean;
  onClose: () => void;
  type: 'pv' | 'advertorial';
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function CreatePageModal({ open, onClose, type }: CreatePageModalProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [lang, setLang] = useState('pt-BR');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slugManual) {
      setSlug(slugify(title));
    }
  }, [title, slugManual]);

  useEffect(() => {
    if (open) {
      setTitle('');
      setSlug('');
      setSlugManual(false);
      setLang('pt-BR');
      setError('');
      // Trigger entrance animation
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open]);

  if (!open) return null;

  const slugValid = slug.trim().length > 0 && /^[a-z0-9-]+$/.test(slug);
  const slugTouched = slug.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !slug.trim()) return;
    setLoading(true);
    setError('');
    try {
      const page = await api.post<{ id: string }>('/pages', {
        title: title.trim(),
        slug: slug.trim(),
        type,
        lang,
        frontmatter: {},
        category_config: {},
      });
      onClose();
      navigate(`/editor/${page.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar página');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      className={`fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className={`bg-surface border border-border rounded-xl w-full max-w-md shadow-2xl transition-all duration-300 ${
          visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            {type === 'pv' ? (
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-4 h-4 text-primary" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <Newspaper className="w-4 h-4 text-accent" />
              </div>
            )}
            <h3 className="text-lg font-semibold text-text">
              {type === 'pv' ? 'Nova Página de Venda' : 'Novo Advertorial'}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1.5">Título</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Produto XYZ"
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-text text-sm placeholder:text-text-muted/50 focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all duration-200"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1.5">Slug</label>
            <div className="relative flex items-center gap-2">
              <span className="text-text-muted text-sm font-mono">/</span>
              <div className="relative flex-1">
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    setSlugManual(true);
                    setSlug(e.target.value);
                  }}
                  placeholder="produto-xyz"
                  className={`w-full bg-surface-2 border rounded-lg px-3 py-2.5 pr-9 text-text text-sm font-mono placeholder:text-text-muted/50 focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all duration-200 ${
                    slugTouched
                      ? slugValid
                        ? 'border-primary/40'
                        : 'border-danger/40'
                      : 'border-border'
                  }`}
                />
                {slugTouched && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {slugValid ? (
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-danger" />
                    )}
                  </span>
                )}
              </div>
            </div>
            {slugTouched && !slugValid && (
              <p className="text-xs text-danger mt-1 ml-5">Use apenas letras minúsculas, números e hífens</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1.5">Língua</label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-text text-sm cursor-pointer focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all duration-200"
            >
              <option value="pt-BR">Português (BR)</option>
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-border text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim() || !slug.trim() || !slugValid}
              className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary text-bg hover:bg-primary/90 cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary focus:ring-2 focus:ring-primary/50 focus:outline-none"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-bg/30 border-t-bg rounded-full animate-spin" />
                  Criando...
                </span>
              ) : (
                'Criar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
