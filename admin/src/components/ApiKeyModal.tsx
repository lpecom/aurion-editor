import { useState } from 'react';
import { Copy, Check, Key } from 'lucide-react';
import Modal from './ui/Modal';
import { api } from '../lib/api';

interface ApiKeyModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface CreatedKey {
  id: string;
  nickname: string;
  api_key: string;
}

export default function ApiKeyModal({ open, onClose, onCreated }: ApiKeyModalProps) {
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!nickname.trim()) return;
    setSaving(true);
    try {
      const data = await api.post<CreatedKey>('/api-keys', { nickname: nickname.trim() });
      setCreatedKey(data);
      onCreated();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey.api_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setNickname('');
    setCreatedKey(null);
    setCopied(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={createdKey ? 'API Key Criada' : 'Nova API Key'}
      footer={
        createdKey ? (
          <button
            onClick={handleClose}
            className="bg-primary text-bg font-medium px-4 py-2 rounded-md hover:bg-primary/90 cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
          >
            Fechar
          </button>
        ) : (
          <>
            <button
              onClick={handleClose}
              className="bg-surface-2 border border-border text-text px-4 py-2 rounded-md hover:bg-surface-2/80 cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !nickname.trim()}
              className="bg-primary text-bg font-medium px-4 py-2 rounded-md hover:bg-primary/90 cursor-pointer transition-colors duration-200 disabled:opacity-50 focus:ring-2 focus:ring-primary/50 focus:outline-none"
            >
              {saving ? 'Criando...' : 'Criar'}
            </button>
          </>
        )
      }
    >
      {createdKey ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <Key className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-200">
              Copie esta chave agora. Ela não será exibida novamente.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Nickname</label>
            <p className="text-sm text-text-muted">{createdKey.nickname}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">API Key</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-bg border border-border rounded-md px-3 py-2 text-sm text-primary/90 font-mono break-all">
                {createdKey.api_key}
              </code>
              <button
                onClick={handleCopy}
                className="shrink-0 p-2 rounded-md bg-surface-2 border border-border text-text-muted hover:text-text cursor-pointer transition-colors duration-200"
                title="Copiar"
              >
                {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Configuração MCP</label>
            <pre className="bg-bg border border-border rounded-lg p-3 text-xs text-text-muted font-mono overflow-x-auto">
{JSON.stringify({
  mcpServers: {
    aurion: {
      url: `${window.location.origin}/api/mcp`,
      headers: {
        Authorization: `Bearer ${createdKey.api_key}`,
      },
    },
  },
}, null, 2)}
            </pre>
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-text mb-1">Nickname</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
            placeholder="Ex: kaka, joao, deploy-bot..."
            autoFocus
          />
          <p className="text-xs text-text-muted mt-1">
            Identifica qual Claude Code fez cada ação no log de atividades.
          </p>
        </div>
      )}
    </Modal>
  );
}
