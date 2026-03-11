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
    <div className="bg-surface border border-border rounded-lg p-12 flex flex-col items-center justify-center text-center">
      <Icon className="w-12 h-12 text-text-muted mb-3" />
      <p className="text-text font-medium mb-1">{title}</p>
      {description && <p className="text-text-muted text-sm max-w-md">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
