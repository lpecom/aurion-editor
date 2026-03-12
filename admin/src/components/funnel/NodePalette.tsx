import { Play, FileText, ExternalLink } from 'lucide-react';

const NODE_TYPES = [
  {
    type: 'entry',
    label: 'Entrada',
    desc: 'Ponto de entrada do funil',
    icon: Play,
    color: 'green',
    bgClass: 'bg-green-400/10 border-green-400/30 hover:border-green-400/60',
    textClass: 'text-green-400',
  },
  {
    type: 'page',
    label: 'Página',
    desc: 'Página do Aurion (PV, advertorial, auxiliar)',
    icon: FileText,
    color: 'blue',
    bgClass: 'bg-blue-400/10 border-blue-400/30 hover:border-blue-400/60',
    textClass: 'text-blue-400',
  },
  {
    type: 'redirect',
    label: 'Redirect',
    desc: 'Redireciona para URL externa',
    icon: ExternalLink,
    color: 'purple',
    bgClass: 'bg-purple-400/10 border-purple-400/30 hover:border-purple-400/60',
    textClass: 'text-purple-400',
  },
];

export default function NodePalette() {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Elementos</h3>
      {NODE_TYPES.map(nt => (
        <div
          key={nt.type}
          draggable
          onDragStart={(e) => onDragStart(e, nt.type)}
          className={`p-3 rounded-lg border cursor-grab active:cursor-grabbing transition-colors duration-200 ${nt.bgClass}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <nt.icon className={`w-4 h-4 ${nt.textClass}`} />
            <span className={`text-sm font-medium ${nt.textClass}`}>{nt.label}</span>
          </div>
          <p className="text-xs text-text-muted">{nt.desc}</p>
        </div>
      ))}
    </div>
  );
}
