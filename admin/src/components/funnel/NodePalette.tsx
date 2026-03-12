import { Play, FileText, ExternalLink } from 'lucide-react';

const NODE_TYPES = [
  {
    type: 'entry',
    label: 'Entrada',
    desc: 'Ponto de entrada do funil',
    icon: Play,
    bgClass: 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/10',
    iconBg: 'bg-emerald-500/20',
    textClass: 'text-emerald-400',
    iconClass: 'text-emerald-400',
  },
  {
    type: 'page',
    label: 'Página',
    desc: 'Página do Aurion (PV, advertorial, auxiliar)',
    icon: FileText,
    bgClass: 'bg-blue-500/5 border-blue-500/20 hover:border-blue-500/40 hover:bg-blue-500/10',
    iconBg: 'bg-blue-500/20',
    textClass: 'text-blue-400',
    iconClass: 'text-blue-400',
  },
  {
    type: 'redirect',
    label: 'Redirect',
    desc: 'Redireciona para URL externa',
    icon: ExternalLink,
    bgClass: 'bg-violet-500/5 border-violet-500/20 hover:border-violet-500/40 hover:bg-violet-500/10',
    iconBg: 'bg-violet-500/20',
    textClass: 'text-violet-400',
    iconClass: 'text-violet-400',
  },
];

export default function NodePalette() {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="p-4 space-y-2">
      <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Elementos</h3>
      {NODE_TYPES.map(nt => (
        <div
          key={nt.type}
          draggable
          onDragStart={(e) => onDragStart(e, nt.type)}
          className={`p-3 rounded-xl border cursor-grab active:cursor-grabbing transition-all duration-200 ${nt.bgClass}`}
        >
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className={`w-7 h-7 rounded-lg ${nt.iconBg} flex items-center justify-center`}>
              <nt.icon className={`w-3.5 h-3.5 ${nt.iconClass}`} />
            </div>
            <span className={`text-sm font-medium ${nt.textClass}`}>{nt.label}</span>
          </div>
          <p className="text-xs text-zinc-500 pl-[38px]">{nt.desc}</p>
        </div>
      ))}
    </div>
  );
}
