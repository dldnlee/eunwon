import * as React from 'react';
import { cn } from '@/lib/utils';

export const Slider = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="range"
      className={cn(
        'h-2 w-full cursor-pointer appearance-none rounded-full bg-hairline accent-ink',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2',
        className
      )}
      {...props}
    />
  )
);
Slider.displayName = 'Slider';
