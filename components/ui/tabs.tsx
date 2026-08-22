'use client';

import { cn } from '@/lib/utils';

export interface PillTabItem {
  value: string;
  label: string;
  /** Optional trailing count, e.g. "지원사업 42" */
  count?: number;
}

/**
 * First-class rounded-full pill tab bar (DESIGN.md `pill-tab` / `pill-tab-active`).
 * Horizontally scrollable on narrow viewports so 5 tabs never wrap or overflow.
 */
export function PillTabs({
  items,
  value,
  onChange,
  className,
}: {
  items: PillTabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn('-mx-xxs flex gap-xs overflow-x-auto px-xxs pb-xxs', className)}
    >
      {items.map((item) => {
        const isActive = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.value)}
            className={cn(
              'flex min-h-11 shrink-0 items-center gap-xxs whitespace-nowrap rounded-full border px-lg py-xs text-body-sm-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2',
              isActive
                ? 'border-ink bg-ink text-on-primary'
                : 'border-hairline bg-canvas text-steel hover:bg-surface'
            )}
          >
            {item.label}
            {item.count != null && (
              <span
                className={cn(
                  'rounded-full px-xxs text-caption',
                  isActive ? 'bg-on-primary/20 text-on-primary' : 'bg-surface text-stone'
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
