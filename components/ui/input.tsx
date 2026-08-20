import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Renders the text-input-error treatment from DESIGN.md. */
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      aria-invalid={error || props['aria-invalid']}
      className={cn(
        'flex h-10 w-full rounded-md border border-hairline bg-canvas px-md py-sm text-body-sm text-ink placeholder:text-stone transition-colors',
        'focus-visible:outline-none focus-visible:border-brand-blue-deep focus-visible:ring-2 focus-visible:ring-brand-blue-deep/30',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'max-sm:min-h-11',
        error && 'border-error focus-visible:border-error focus-visible:ring-error/30',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';
