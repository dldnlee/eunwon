import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={error || props['aria-invalid']}
      className={cn(
        'flex min-h-[80px] w-full rounded-md border border-hairline bg-canvas px-md py-sm text-body-sm text-ink placeholder:text-stone transition-colors',
        'focus-visible:outline-none focus-visible:border-brand-blue-deep focus-visible:ring-2 focus-visible:ring-brand-blue-deep/30',
        'disabled:cursor-not-allowed disabled:opacity-50',
        error && 'border-error focus-visible:border-error focus-visible:ring-error/30',
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';
