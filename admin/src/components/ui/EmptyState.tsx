import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="bg-surface border border-border/50 rounded-2xl p-12 flex flex-col items-center justify-center text-center animate-fade-in">
      <div className="rounded-2xl bg-surface-2/50 p-4 mb-4">
        <Icon className="w-10 h-10 text-zinc-500" />
      </div>
      <p className="text-text text-lg font-semibold mb-1">{title}</p>
      {description && <p className="text-zinc-500 text-sm max-w-md leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
