import { useState, useMemo } from 'react';
import ScriptPreview from './ScriptPreview';

interface Options {
  disableRightClick: boolean;
  disableTextSelection: boolean;
  disableImageDrag: boolean;
  disableCopyShortcuts: boolean;
  customMessage: string;
}

const defaultOptions: Options = {
  disableRightClick: true,
  disableTextSelection: true,
  disableImageDrag: true,
  disableCopyShortcuts: true,
  customMessage: '',
};

export default function AntiCopyBuilder() {
  const [options, setOptions] = useState<Options>(defaultOptions);

  const code = useMemo(() => {
    const parts: string[] = [];
    parts.push('<script>');
    parts.push('(function(){');

    if (options.disableRightClick) {
      if (options.customMessage) {
        parts.push(`  document.addEventListener('contextmenu',function(e){e.preventDefault();alert('${options.customMessage.replace(/'/g, "\\'")}');});`);
      } else {
        parts.push("  document.addEventListener('contextmenu',function(e){e.preventDefault();});");
      }
    }

    if (options.disableTextSelection) {
      parts.push("  document.body.style.userSelect='none';");
      parts.push("  document.body.style.webkitUserSelect='none';");
      parts.push("  document.addEventListener('selectstart',function(e){e.preventDefault();});");
    }

    if (options.disableImageDrag) {
      parts.push("  document.addEventListener('dragstart',function(e){if(e.target.tagName==='IMG')e.preventDefault();});");
    }

    if (options.disableCopyShortcuts) {
      parts.push("  document.addEventListener('keydown',function(e){");
      parts.push("    if((e.ctrlKey||e.metaKey)&&['c','a','u','s'].indexOf(e.key.toLowerCase())!==-1){e.preventDefault();}");
      parts.push("  });");
    }

    parts.push('})();');
    parts.push('</script>');

    return parts.join('\n');
  }, [options]);

  const hasAnyOption = options.disableRightClick || options.disableTextSelection || options.disableImageDrag || options.disableCopyShortcuts;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {[
          { key: 'disableRightClick' as const, label: 'Bloquear clique direito', desc: 'Desabilita o menu de contexto do navegador' },
          { key: 'disableTextSelection' as const, label: 'Bloquear seleção de texto', desc: 'Impede selecionar e copiar texto da página' },
          { key: 'disableImageDrag' as const, label: 'Bloquear arrastar imagens', desc: 'Impede arrastar imagens para salvar' },
          { key: 'disableCopyShortcuts' as const, label: 'Bloquear atalhos de cópia', desc: 'Bloqueia Ctrl+C, Ctrl+A, Ctrl+U, Ctrl+S' },
        ].map(({ key, label, desc }) => (
          <label key={key} className="flex items-start gap-3 p-3 rounded-lg bg-surface-2/50 border border-border hover:border-primary/30 cursor-pointer transition-colors duration-200">
            <button
              type="button"
              role="switch"
              aria-checked={options[key]}
              onClick={() => setOptions(prev => ({ ...prev, [key]: !prev[key] }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full shrink-0 cursor-pointer transition-colors duration-200 mt-0.5 ${
                options[key] ? 'bg-primary' : 'bg-surface-2 border border-border'
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                options[key] ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
            <div>
              <div className="text-sm font-medium text-text">{label}</div>
              <div className="text-xs text-text-muted">{desc}</div>
            </div>
          </label>
        ))}
      </div>

      {options.disableRightClick && (
        <div>
          <label className="block text-sm font-medium text-text mb-1">Mensagem ao clicar direito (opcional)</label>
          <input
            type="text"
            value={options.customMessage}
            onChange={(e) => setOptions(prev => ({ ...prev, customMessage: e.target.value }))}
            className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
            placeholder="Conteúdo protegido!"
          />
        </div>
      )}

      {hasAnyOption && <ScriptPreview code={code} name="Anti-Cópia" position="body_end" />}
    </div>
  );
}
