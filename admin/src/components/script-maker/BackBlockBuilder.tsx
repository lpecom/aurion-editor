import { useState, useMemo } from 'react';
import ScriptPreview from './ScriptPreview';

interface Options {
  enabled: boolean;
  redirectUrl: string;
}

export default function BackBlockBuilder() {
  const [options, setOptions] = useState<Options>({ enabled: true, redirectUrl: '' });

  const code = useMemo(() => {
    if (!options.enabled) return '';
    const parts: string[] = [];
    parts.push('<script>');
    parts.push('(function(){');
    parts.push("  history.pushState(null,null,location.href);");
    parts.push("  window.addEventListener('popstate',function(){");
    if (options.redirectUrl) {
      parts.push(`    window.location.replace('${options.redirectUrl.replace(/'/g, "\\'")}');`);
    } else {
      parts.push("    history.pushState(null,null,location.href);");
    }
    parts.push("  });");
    parts.push('})();');
    parts.push('</script>');
    return parts.join('\n');
  }, [options]);

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 p-3 rounded-lg bg-surface-2/50 border border-border hover:border-primary/30 cursor-pointer transition-colors duration-200">
        <button
          type="button"
          role="switch"
          aria-checked={options.enabled}
          onClick={() => setOptions(prev => ({ ...prev, enabled: !prev.enabled }))}
          className={`relative inline-flex h-6 w-11 items-center rounded-full shrink-0 cursor-pointer transition-colors duration-200 mt-0.5 ${
            options.enabled ? 'bg-primary' : 'bg-surface-2 border border-border'
          }`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            options.enabled ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
        <div>
          <div className="text-sm font-medium text-text">Bloquear botão voltar</div>
          <div className="text-xs text-text-muted">Impede o visitante de voltar para a página anterior usando history.pushState</div>
        </div>
      </label>

      {options.enabled && (
        <div>
          <label className="block text-sm font-medium text-text mb-1">URL de redirecionamento (opcional)</label>
          <input
            type="text"
            value={options.redirectUrl}
            onChange={(e) => setOptions(prev => ({ ...prev, redirectUrl: e.target.value }))}
            className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
            placeholder="https://exemplo.com (deixe vazio para manter na mesma página)"
          />
          <p className="text-xs text-text-muted mt-1">Se preenchido, ao tentar voltar o visitante será redirecionado para esta URL.</p>
        </div>
      )}

      {options.enabled && <ScriptPreview code={code} name="Bloqueio de Voltar" position="body_end" />}
    </div>
  );
}
