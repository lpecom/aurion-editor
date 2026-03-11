import type { ReactNode } from 'react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'default' | 'info';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-primary/10 text-primary',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  default: 'bg-surface-2 text-text-muted',
  info: 'bg-accent/10 text-accent',
};

export default function Badge({ variant = 'default', children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full ${variantClasses[variant]}`}>
      {children}
    </span>
  );
}
