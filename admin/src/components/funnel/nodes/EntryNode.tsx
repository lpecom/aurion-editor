import { Handle, Position } from '@xyflow/react';
import { Play } from 'lucide-react';

interface EntryNodeData {
  entry_slug?: string;
}

export default function EntryNode({ data, selected }: { data: EntryNodeData; selected?: boolean }) {
  return (
    <div className={`px-4 py-3 rounded-xl border min-w-[180px] backdrop-blur-sm transition-all duration-200 ${
      selected
        ? 'border-emerald-500 shadow-[0_0_24px_rgba(34,197,94,0.2)] bg-emerald-500/10'
        : 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50'
    }`}>
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center relative">
          <Play className="w-3.5 h-3.5 text-emerald-400" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <span className="text-sm font-semibold text-emerald-400">Entrada</span>
      </div>
      <p className="text-xs text-zinc-400 mt-2 font-mono">/{data.entry_slug || '...'}</p>
      <Handle type="source" position={Position.Right} className="!bg-emerald-500 !w-3 !h-3 !border-2 !border-emerald-500/30" />
    </div>
  );
}
