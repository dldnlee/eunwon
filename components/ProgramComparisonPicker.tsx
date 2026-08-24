'use client';

import Link from 'next/link';
import { Check, GitCompareArrows, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Program } from '@/lib/types';
import { cn } from '@/lib/utils';

export function CompareSelectionControl({
  program,
  selected,
  disabled,
  onToggle,
}: {
  program: Pick<Program, 'id' | 'title'>;
  selected: boolean;
  disabled: boolean;
  onToggle: (program: Pick<Program, 'id' | 'title'>) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${program.title} 비교 ${selected ? '선택 해제' : '선택'}`}
      disabled={disabled && !selected}
      onClick={() => onToggle(program)}
      className={cn(
        'mb-xs inline-flex min-h-11 w-full items-center justify-center gap-xs rounded-full border px-md text-button-md transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2',
        selected
          ? 'border-ink bg-ink text-on-primary'
          : 'border-hairline bg-canvas text-charcoal hover:bg-surface',
        disabled && !selected && 'cursor-not-allowed text-muted'
      )}
    >
      <span
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-full border',
          selected ? 'border-on-primary bg-on-primary text-ink' : 'border-hairline bg-canvas'
        )}
        aria-hidden="true"
      >
        {selected && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      {selected ? '비교 선택됨' : disabled ? '최대 4개 선택 가능' : '비교에 추가'}
    </button>
  );
}

export function ComparisonTray({
  selected,
  onRemove,
  onClear,
}: {
  selected: Array<Pick<Program, 'id' | 'title'>>;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  if (selected.length === 0) return null;

  const compareHref = `/compare?ids=${selected.map((program) => program.id).join(',')}`;
  const canCompare = selected.length >= 2;

  return (
    <aside
      aria-label="선택한 지원사업 비교"
      className="fixed inset-x-md bottom-md z-30 mx-auto max-w-3xl rounded-xl border border-hairline bg-canvas p-md shadow-modal sm:inset-x-xl"
    >
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-xs">
            <GitCompareArrows className="h-4 w-4 text-ink" aria-hidden="true" />
            <p className="text-body-sm-medium text-ink">비교할 사업 {selected.length}/4</p>
          </div>
          <div className="mt-xs flex max-h-24 flex-wrap gap-xs overflow-y-auto" aria-live="polite">
            {selected.map((program) => (
              <span
                key={program.id}
                className="inline-flex max-w-full items-center gap-xxs rounded-full border border-hairline bg-surface py-xxs pl-sm pr-xxs text-caption text-charcoal"
              >
                <span className="max-w-48 truncate">{program.title}</span>
                <button
                  type="button"
                  onClick={() => onRemove(program.id)}
                  aria-label={`${program.title} 비교에서 제거`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2 max-sm:h-11 max-sm:w-11"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
          {!canCompare && (
            <p className="mt-xs text-caption text-steel">비교하려면 한 개를 더 선택해 주세요.</p>
          )}
        </div>
        <div className="flex shrink-0 gap-xs max-sm:w-full">
          <Button type="button" variant="ghost" size="sm" onClick={onClear} className="max-sm:flex-1">
            선택 해제
          </Button>
          {canCompare ? (
            <Link
              href={compareHref}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-lg text-button-md text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2 max-sm:flex-1"
            >
              선택 사업 비교
            </Link>
          ) : (
            <Button type="button" size="sm" disabled className="max-sm:flex-1">
              선택 사업 비교
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
