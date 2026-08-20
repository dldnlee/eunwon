import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-[10px] py-[4px] text-[13px] font-semibold leading-[1.4]',
  {
    variants: {
      variant: {
        // General informational / AI / Pro-tier accent chip (badge-beta pattern)
        default: 'bg-brand-blue-200 text-brand-blue-700',
        // Quiet neutral tag
        secondary: 'bg-surface text-steel',
        // Confirmation / saved-active state
        success: 'bg-success-bg text-success-text',
        // Elevated-but-not-urgent notice (e.g. deadline approaching)
        warning: 'bg-surface-soft text-charcoal',
        // Urgent accent — reserved for deadline urgency per DESIGN.md adaptation notes
        destructive: 'bg-brand-coral text-on-dark',
        // Minimal outlined tag
        outline: 'border border-hairline bg-transparent text-ink',
      },
    },
    defaultVariants: { variant: 'secondary' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
