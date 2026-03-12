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
    <div className="bg-surface border border-border rounded-lg p-12 flex flex-col items-center justify-center text-center animate-in fade-in duration-300">
      <div className="rounded-2xl bg-surface-2/50 p-4 mb-4">
        <Icon className="w-10 h-10 text-text-muted" />
      </div>
      <p className="text-text text-lg font-semibold mb-1">{title}</p>
      {description && <p className="text-text-muted text-sm max-w-md leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
