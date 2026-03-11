import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
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
    }
  }, [open]);

  if (!open) return null;

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
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
    >
      <div className="bg-surface border border-border rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-lg font-semibold text-text">
            {type === 'pv' ? 'Nova Página de Venda' : 'Novo Advertorial'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-colors duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1.5">Título</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Produto XYZ"
              className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-text text-sm placeholder:text-text-muted/50 focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1.5">Slug</label>
            <div className="flex items-center gap-2">
              <span className="text-text-muted text-sm">/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlugManual(true);
                  setSlug(e.target.value);
                }}
                placeholder="produto-xyz"
                className="flex-1 bg-surface-2 border border-border rounded-md px-3 py-2 text-text text-sm font-mono placeholder:text-text-muted/50 focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1.5">Língua</label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-text text-sm cursor-pointer focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
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
              className="flex-1 px-4 py-2 text-sm font-medium rounded-md border border-border text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-colors duration-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim() || !slug.trim()}
              className="flex-1 px-4 py-2 text-sm font-medium rounded-md bg-primary text-bg hover:bg-primary/90 cursor-pointer transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Criando...' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
