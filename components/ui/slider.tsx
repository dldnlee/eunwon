import * as React from 'react';
import { cn } from '@/lib/utils';

export const Slider = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="range"
      className={cn(
        'h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-600',
        className
      )}
      {...props}
    />
  )
);
Slider.displayName = 'Slider';
