import { Handle, Position } from '@xyflow/react';
import { ExternalLink } from 'lucide-react';

interface RedirectNodeData {
  url?: string;
  status_code?: number;
}

export default function RedirectNode({ data, selected }: { data: RedirectNodeData; selected?: boolean }) {
  return (
    <div className={`px-4 py-3 rounded-xl border min-w-[200px] backdrop-blur-sm transition-all duration-200 ${
      selected
        ? 'border-violet-500 shadow-[0_0_24px_rgba(139,92,246,0.2)] bg-violet-500/10'
        : 'border-violet-500/30 bg-violet-500/5 hover:border-violet-500/50'
    }`}>
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center">
          <ExternalLink className="w-3.5 h-3.5 text-violet-400" />
        </div>
        <span className="text-sm font-semibold text-violet-400">Redirect</span>
      </div>
      <p className="text-xs text-zinc-400 mt-2 truncate max-w-[180px]">{data.url || 'URL não definida'}</p>
      <p className="text-xs text-violet-400/50 mt-1 font-mono">{data.status_code || 302}</p>
      <Handle type="target" position={Position.Left} className="!bg-violet-500 !w-3 !h-3 !border-2 !border-violet-500/30" />
    </div>
  );
}
