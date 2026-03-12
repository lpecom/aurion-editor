import { useState, useMemo } from 'react';
import ScriptPreview from './ScriptPreview';

interface Options {
  blockF12: boolean;
  blockShortcuts: boolean;
  detectDebugger: boolean;
  detectResize: boolean;
  action: 'redirect' | 'close' | 'none';
  redirectUrl: string;
}

const defaultOptions: Options = {
  blockF12: true,
  blockShortcuts: true,
  detectDebugger: false,
  detectResize: false,
  action: 'none',
  redirectUrl: '',
};

export default function DevToolsBlockBuilder() {
  const [options, setOptions] = useState<Options>(defaultOptions);

  const code = useMemo(() => {
    const hasAny = options.blockF12 || options.blockShortcuts || options.detectDebugger || options.detectResize;
    if (!hasAny) return '';

    const parts: string[] = [];
    parts.push('<script>');
    parts.push('(function(){');

    // Action function
    if (options.action === 'redirect' && options.redirectUrl) {
      parts.push(`  function onDetect(){window.location.replace('${options.redirectUrl.replace(/'/g, "\\'")}');}`)
    } else if (options.action === 'close') {
      parts.push("  function onDetect(){window.close();window.location.replace('about:blank');}");
    } else {
      parts.push("  function onDetect(){}");
    }

    if (options.blockF12 || options.blockShortcuts) {
      parts.push("  document.addEventListener('keydown',function(e){");
      if (options.blockF12) {
        parts.push("    if(e.key==='F12'){e.preventDefault();onDetect();}");
      }
      if (options.blockShortcuts) {
        parts.push("    if((e.ctrlKey||e.metaKey)&&e.shiftKey&&['i','j','c'].indexOf(e.key.toLowerCase())!==-1){e.preventDefault();onDetect();}");
        parts.push("    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='u'){e.preventDefault();onDetect();}");
      }
      parts.push("  });");
    }

    if (options.detectDebugger) {
      parts.push("  (function check(){");
      parts.push("    var start=performance.now();");
      parts.push("    debugger;");
      parts.push("    if(performance.now()-start>100){onDetect();}");
      parts.push("    setTimeout(check,1000);");
      parts.push("  })();");
    }

    if (options.detectResize) {
      parts.push("  var threshold=160;");
      parts.push("  window.addEventListener('resize',function(){");
      parts.push("    if(window.outerWidth-window.innerWidth>threshold||window.outerHeight-window.innerHeight>threshold){onDetect();}");
      parts.push("  });");
    }

    parts.push('})();');
    parts.push('</script>');
    return parts.join('\n');
  }, [options]);

  const hasAny = options.blockF12 || options.blockShortcuts || options.detectDebugger || options.detectResize;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {[
          { key: 'blockF12' as const, label: 'Bloquear F12', desc: 'Impede abertura do DevTools via tecla F12' },
          { key: 'blockShortcuts' as const, label: 'Bloquear atalhos', desc: 'Bloqueia Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U' },
          { key: 'detectDebugger' as const, label: 'Detectar debugger', desc: 'Usa statement debugger para detectar DevTools aberto (pode impactar performance)' },
          { key: 'detectResize' as const, label: 'Detectar redimensionamento', desc: 'Detecta DevTools dockado via diferença de tamanho da janela' },
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

      {hasAny && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-text mb-2">Ação ao detectar</label>
            <div className="flex gap-2">
              {[
                { value: 'none' as const, label: 'Apenas bloquear teclas' },
                { value: 'redirect' as const, label: 'Redirecionar' },
                { value: 'close' as const, label: 'Fechar aba' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setOptions(prev => ({ ...prev, action: value }))}
                  className={`px-3 py-1.5 rounded-md text-sm cursor-pointer transition-colors duration-200 ${
                    options.action === value
                      ? 'bg-primary text-bg font-medium'
                      : 'bg-surface-2 border border-border text-text-muted hover:text-text'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {options.action === 'redirect' && (
            <div>
              <label className="block text-sm font-medium text-text mb-1">URL de redirecionamento</label>
              <input
                type="text"
                value={options.redirectUrl}
                onChange={(e) => setOptions(prev => ({ ...prev, redirectUrl: e.target.value }))}
                className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
                placeholder="https://google.com"
              />
            </div>
          )}
        </div>
      )}

      {hasAny && <ScriptPreview code={code} name="Bloqueio DevTools" position="head" />}
    </div>
  );
}
