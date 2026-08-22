import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className={cn('relative inline-block w-full', className)}>
      <select
        ref={ref}
        className={cn(
          // min-h (not h) — h-10 is shorter than py-sm's padding plus text-body-sm's line-height
          // combined, which clipped the option text against the bottom edge.
          'min-h-10 w-full appearance-none rounded-md border border-hairline bg-canvas px-md py-sm pr-9 text-body-sm text-ink transition-colors',
          'focus-visible:outline-none focus-visible:border-brand-blue-deep focus-visible:ring-2 focus-visible:ring-brand-blue-deep/30',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'max-sm:min-h-11'
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-sm top-1/2 h-4 w-4 -translate-y-1/2 text-steel"
      />
    </div>
  )
);
Select.displayName = 'Select';
