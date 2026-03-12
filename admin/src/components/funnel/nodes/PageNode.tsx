import { Handle, Position, NodeProps } from '@xyflow/react';
import { FileText } from 'lucide-react';

export default function PageNode({ data, selected }: NodeProps) {
  return (
    <div className={`px-4 py-3 rounded-xl border-2 min-w-[200px] ${
      selected ? 'border-blue-400 shadow-lg shadow-blue-400/20' : 'border-blue-400/50'
    } bg-blue-400/10`}>
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-semibold text-text">{data.title || 'Selecione página'}</span>
      </div>
      {data.slug && <p className="text-xs text-text-muted mt-1 font-mono">/{data.slug}</p>}
      {data.cta_selector && (
        <p className="text-xs text-blue-400/60 mt-1">CTA: {data.cta_selector}</p>
      )}
      <Handle type="target" position={Position.Left} className="!bg-blue-400 !w-3 !h-3 !border-2 !border-blue-400/50" />
      <Handle type="source" position={Position.Right} className="!bg-blue-400 !w-3 !h-3 !border-2 !border-blue-400/50" />
    </div>
  );
}
