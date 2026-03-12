import { useState } from 'react';
import { Copy, Check, Save, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';

interface ScriptPreviewProps {
  code: string;
  name: string;
  position?: string;
}

export default function ScriptPreview({ code, name, position = 'body_end' }: ScriptPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/scripts', {
        name: `[Script Maker] ${name}`,
        position,
        code,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const addLineNumbers = (text: string) => {
    return text.split('\n').map((line, i) => (
      <div key={i} className="flex">
        <span className="select-none text-text-muted/40 w-10 shrink-0 text-right pr-3 text-xs">{i + 1}</span>
        <span className="flex-1 text-primary/90">{line || ' '}</span>
      </div>
    ));
  };

  if (!code) return null;

  return (
    <div className="mt-4 border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-surface-2/30 border-b border-border">
        <span className="text-xs text-text-muted font-mono">Codigo gerado</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-surface-2 border border-border text-text-muted hover:text-text cursor-pointer transition-colors duration-200"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 cursor-pointer transition-colors duration-200 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar como Script'}
          </button>
        </div>
      </div>
      <pre className="p-4 text-sm font-mono overflow-x-auto leading-relaxed bg-bg max-h-[400px] overflow-y-auto">
        {addLineNumbers(code)}
      </pre>
    </div>
  );
}
