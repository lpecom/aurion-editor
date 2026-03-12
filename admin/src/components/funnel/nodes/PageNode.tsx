import { Handle, Position } from '@xyflow/react';
import { FileText } from 'lucide-react';

interface PageNodeData {
  title?: string;
  slug?: string;
  cta_selector?: string;
}

export default function PageNode({ data, selected }: { data: PageNodeData; selected?: boolean }) {
  return (
    <div className={`px-4 py-3 rounded-xl border min-w-[200px] backdrop-blur-sm transition-all duration-200 ${
      selected
        ? 'border-blue-500 shadow-[0_0_24px_rgba(59,130,246,0.2)] bg-blue-500/10'
        : 'border-blue-500/30 bg-blue-500/5 hover:border-blue-500/50'
    }`}>
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
          <FileText className="w-3.5 h-3.5 text-blue-400" />
        </div>
        <span className="text-sm font-semibold text-zinc-200">{data.title || 'Selecione página'}</span>
      </div>
      {data.slug && <p className="text-xs text-zinc-400 mt-2 font-mono">/{data.slug}</p>}
      {data.cta_selector && (
        <p className="text-xs text-blue-400/60 mt-1.5 font-mono">CTA: {data.cta_selector}</p>
      )}
      <Handle type="target" position={Position.Left} className="!bg-blue-500 !w-3 !h-3 !border-2 !border-blue-500/30" />
      <Handle type="source" position={Position.Right} className="!bg-blue-500 !w-3 !h-3 !border-2 !border-blue-500/30" />
    </div>
  );
}
