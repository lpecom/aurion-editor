import type { ReactNode } from 'react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'default' | 'info';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-primary/15 text-primary border border-primary/20',
  warning: 'bg-warning/15 text-warning border border-warning/20',
  danger: 'bg-danger/15 text-danger border border-danger/20',
  default: 'bg-surface-2 text-text-muted border border-border',
  info: 'bg-accent/15 text-accent border border-accent/20',
};

const dotClasses: Record<BadgeVariant, string> = {
  success: 'bg-primary',
  warning: 'bg-warning',
  danger: 'bg-danger',
  default: 'bg-text-muted',
  info: 'bg-accent',
};

export default function Badge({ variant = 'default', children, dot }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full transition-colors duration-200 ${variantClasses[variant]}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotClasses[variant]}`} />}
      {children}
    </span>
  );
}
