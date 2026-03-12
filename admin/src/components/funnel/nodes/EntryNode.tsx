import { Handle, Position } from '@xyflow/react';
import { Play } from 'lucide-react';

interface EntryNodeData {
  entry_slug?: string;
}

export default function EntryNode({ data, selected }: { data: EntryNodeData; selected?: boolean }) {
  return (
    <div className={`px-4 py-3 rounded-xl border-2 min-w-[180px] ${
      selected ? 'border-green-400 shadow-lg shadow-green-400/20' : 'border-green-400/50'
    } bg-green-400/10`}>
      <div className="flex items-center gap-2">
        <Play className="w-4 h-4 text-green-400" />
        <span className="text-sm font-semibold text-green-400">Entrada</span>
      </div>
      <p className="text-xs text-text-muted mt-1 font-mono">/{data.entry_slug || '...'}</p>
      <Handle type="source" position={Position.Right} className="!bg-green-400 !w-3 !h-3 !border-2 !border-green-400/50" />
    </div>
  );
}
