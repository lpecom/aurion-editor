import { Handle, Position, NodeProps } from '@xyflow/react';
import { ExternalLink } from 'lucide-react';

export default function RedirectNode({ data, selected }: NodeProps) {
  return (
    <div className={`px-4 py-3 rounded-xl border-2 min-w-[200px] ${
      selected ? 'border-purple-400 shadow-lg shadow-purple-400/20' : 'border-purple-400/50'
    } bg-purple-400/10`}>
      <div className="flex items-center gap-2">
        <ExternalLink className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-semibold text-purple-400">Redirect</span>
      </div>
      <p className="text-xs text-text-muted mt-1 truncate max-w-[180px]">{data.url || 'URL não definida'}</p>
      <p className="text-xs text-purple-400/60 mt-0.5">{data.status_code || 302}</p>
      <Handle type="target" position={Position.Left} className="!bg-purple-400 !w-3 !h-3 !border-2 !border-purple-400/50" />
    </div>
  );
}
