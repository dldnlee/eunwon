import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full text-button-md transition-colors disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-on-primary hover:bg-charcoal disabled:bg-hairline disabled:text-muted',
        secondary:
          'border border-hairline bg-canvas text-ink hover:bg-surface disabled:border-hairline disabled:text-muted',
        outline:
          'border border-ink bg-transparent text-ink hover:bg-surface disabled:border-hairline disabled:text-muted',
        ghost:
          'bg-transparent text-ink hover:bg-surface disabled:text-muted',
        success:
          'bg-success-bg text-success-text hover:bg-success-bg/70 disabled:bg-hairline disabled:text-muted',
        destructive:
          'bg-error text-on-dark hover:bg-error/90 disabled:bg-hairline disabled:text-muted',
        link:
          'rounded-none bg-transparent p-0 text-ink underline-offset-4 hover:underline disabled:text-muted',
      },
      size: {
        default: 'h-10 px-xl py-[11px] max-sm:min-h-11',
        sm: 'h-9 px-lg py-xs max-sm:min-h-11',
        lg: 'h-12 px-xxl py-md max-sm:min-h-12',
        icon: 'h-9 w-9 p-0 max-sm:h-11 max-sm:w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = 'Button';
