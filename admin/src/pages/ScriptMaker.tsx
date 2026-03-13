import { useState } from 'react';
import { Wand2, ShieldOff, ArrowLeftCircle, MonitorOff, Eye, ChevronLeft } from 'lucide-react';
import AntiCopyBuilder from '../components/script-maker/AntiCopyBuilder';
import BackBlockBuilder from '../components/script-maker/BackBlockBuilder';
import DevToolsBlockBuilder from '../components/script-maker/DevToolsBlockBuilder';
import CloakerBuilder from '../components/script-maker/CloakerBuilder';

type ScriptType = 'cloaker' | 'anti-copy' | 'back-block' | 'dev-tools' | null;

const SCRIPT_TYPES = [
  {
    id: 'cloaker' as const,
    label: 'Cloaker',
    desc: 'Filtra tráfego por país, dispositivo, navegador e referrer. Protege suas páginas de acessos indesejados.',
    icon: Eye,
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
    borderColor: 'border-red-400/30',
  },
  {
    id: 'anti-copy' as const,
    label: 'Anti-Cópia',
    desc: 'Bloqueia clique direito, seleção de texto, arrastar imagens e atalhos de cópia.',
    icon: ShieldOff,
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    borderColor: 'border-blue-400/30',
  },
  {
    id: 'back-block' as const,
    label: 'Bloqueio de Voltar',
    desc: 'Impede o visitante de voltar para a página anterior usando o botão voltar do navegador.',
    icon: ArrowLeftCircle,
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
    borderColor: 'border-amber-400/30',
  },
  {
    id: 'dev-tools' as const,
    label: 'Disable Dev Tools',
    desc: 'Bloqueia abertura do DevTools (F12, Ctrl+Shift+I) e detecta tentativas de inspecionar.',
    icon: MonitorOff,
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
    borderColor: 'border-purple-400/30',
  },
];

export default function ScriptMaker() {
  const [active, setActive] = useState<ScriptType>(null);

  const activeType = SCRIPT_TYPES.find(t => t.id === active);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <Wand2 className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text">Script Maker</h1>
          <p className="text-sm text-text-muted">Monte scripts prontos para proteger e otimizar suas páginas.</p>
        </div>
      </div>

      {!active ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SCRIPT_TYPES.map(type => (
            <button
              key={type.id}
              onClick={() => setActive(type.id)}
              className={`text-left p-5 rounded-lg border ${type.borderColor} ${type.bgColor} hover:scale-[1.02] cursor-pointer transition-all duration-200 group focus:ring-2 focus:ring-primary/50 focus:outline-none`}
            >
              <div className="flex items-center gap-3 mb-2">
                <type.icon className={`w-5 h-5 ${type.color}`} />
                <h3 className="text-base font-semibold text-text">{type.label}</h3>
              </div>
              <p className="text-sm text-text-muted leading-relaxed">{type.desc}</p>
            </button>
          ))}
        </div>
      ) : (
        <div>
          <button
            onClick={() => setActive(null)}
            className="flex items-center gap-2 text-sm text-text-muted hover:text-text cursor-pointer transition-colors duration-200 mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar para tipos
          </button>

          <div className="bg-surface border border-border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-5">
              {activeType && <activeType.icon className={`w-5 h-5 ${activeType.color}`} />}
              <h2 className="text-lg font-semibold text-text">{activeType?.label}</h2>
            </div>

            {active === 'cloaker' && <CloakerBuilder />}
            {active === 'anti-copy' && <AntiCopyBuilder />}
            {active === 'back-block' && <BackBlockBuilder />}
            {active === 'dev-tools' && <DevToolsBlockBuilder />}
          </div>
        </div>
      )}
    </div>
  );
}
