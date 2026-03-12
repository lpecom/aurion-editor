import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Languages, Loader2, AlertCircle } from 'lucide-react';
import Modal from './ui/Modal';
import { api } from '../lib/api';

interface TranslatePageModalProps {
  open: boolean;
  onClose: () => void;
  pageId: string;
  pageTitle: string;
}

interface Language {
  id: string;
  code: string;
  name: string;
  flag: string | null;
}

interface Provider {
  id: string;
  provider: string;
  model: string | null;
  active: number;
}

export default function TranslatePageModal({ open, onClose, pageId, pageTitle }: TranslatePageModalProps) {
  const navigate = useNavigate();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [targetLang, setTargetLang] = useState('');
  const [providerId, setProviderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setTargetLang('');
      setProviderId('');
      setError('');
      setLoading(false);

      api.get<Language[]>('/languages').then(setLanguages).catch(() => {});
      api.get<Provider[]>('/translation-providers').then((data) => {
        const active = data.filter((p) => p.active);
        setProviders(active);
      }).catch(() => {});
    }
  }, [open]);

  async function handleSubmit() {
    if (!targetLang || !providerId) return;
    setLoading(true);
    setError('');
    try {
      const newPage = await api.post<{ id: string }>(`/pages/${pageId}/translate`, {
        target_lang: targetLang,
        provider_id: providerId,
      });
      onClose();
      navigate(`/editor/${newPage.id}`);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('409')) {
        setError('Já existe uma tradução desta página para este idioma.');
      } else {
        setError(err instanceof Error ? err.message : 'Erro ao traduzir página');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Traduzir Página"
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
            onClick={handleSubmit}
            disabled={loading || !targetLang || !providerId}
            className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary text-bg hover:bg-primary/90 cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary focus:ring-2 focus:ring-primary/50 focus:outline-none flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Traduzindo...
              </>
            ) : (
              <>
                <Languages className="w-4 h-4" />
                Traduzir
              </>
            )}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm text-text-muted bg-surface-2 border border-border rounded-lg px-3 py-2.5">
          <Languages className="w-4 h-4 shrink-0" />
          <span>Página: <strong className="text-text">{pageTitle}</strong></span>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-muted mb-1.5">Idioma de destino</label>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-text text-sm cursor-pointer focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
          >
            <option value="">Selecione um idioma</option>
            {languages.map((lang) => (
              <option key={lang.id} value={lang.code}>
                {lang.flag ? `${lang.flag} ` : ''}{lang.name} ({lang.code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-muted mb-1.5">Provedor de tradução</label>
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-text text-sm cursor-pointer focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
          >
            <option value="">Selecione um provedor</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.provider === 'google' ? 'Google Translate' : 'OpenAI'}{p.model ? ` (${p.model})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}
