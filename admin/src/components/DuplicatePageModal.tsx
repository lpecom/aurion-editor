import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, CheckCircle2, AlertCircle } from 'lucide-react';
import Modal from './ui/Modal';
import { api } from '../lib/api';

interface DuplicatePageModalProps {
  open: boolean;
  onClose: () => void;
  pageId: string;
  pageTitle: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function DuplicatePageModal({ open, onClose, pageId, pageTitle }: DuplicatePageModalProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      const defaultTitle = `${pageTitle} — Variante`;
      setTitle(defaultTitle);
      setSlug(slugify(defaultTitle));
      setSlugManual(false);
      setError('');
    }
  }, [open, pageTitle]);

  useEffect(() => {
    if (!slugManual) {
      setSlug(slugify(title));
    }
  }, [title, slugManual]);

  const slugValid = slug.trim().length > 0 && /^[a-z0-9-]+$/.test(slug);
  const slugTouched = slug.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !slug.trim() || !slugValid) return;
    setLoading(true);
    setError('');
    try {
      const newPage = await api.post<{ id: string }>(`/pages/${pageId}/duplicate`, {
        title: title.trim(),
        slug: slug.trim(),
      });
      onClose();
      navigate(`/editor/${newPage.id}`);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('409')) {
        setError('Já existe uma página com esse slug. Escolha outro.');
      } else {
        setError(err instanceof Error ? err.message : 'Erro ao duplicar página');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Duplicar Página"
      maxWidth="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium rounded-lg border border-border text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={loading || !title.trim() || !slug.trim() || !slugValid}
            className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary text-bg hover:bg-primary/90 cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary focus:ring-2 focus:ring-primary/50 focus:outline-none flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-bg/30 border-t-bg rounded-full animate-spin" />
                Duplicando...
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Duplicar
              </>
            )}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
            placeholder="Ex: Produto XYZ — Variante B"
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
                placeholder="produto-xyz-variante-b"
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
      </form>
    </Modal>
  );
}
