import { ListChecks, Bookmark, AlarmClock, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

function StatCard({
  icon: Icon,
  value,
  label,
  accent = false,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-md rounded-xl border border-hairline bg-canvas p-lg">
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
          accent ? 'bg-brand-coral/10' : 'bg-surface'
        )}
      >
        <Icon className={cn('h-5 w-5', accent ? 'text-brand-coral' : 'text-ink')} aria-hidden="true" />
      </div>
      <div>
        <p className={cn('text-heading-md', accent ? 'text-brand-coral' : 'text-ink')}>{value}</p>
        <p className="text-body-sm text-steel">{label}</p>
      </div>
    </div>
  );
}

export function DashboardSummary({
  matchedCount,
  savedCount,
  deadlineSoonCount,
}: {
  matchedCount: number;
  savedCount: number;
  deadlineSoonCount: number;
}) {
  return (
    <div className="mb-xl grid grid-cols-1 gap-md sm:grid-cols-3">
      <StatCard icon={ListChecks} value={matchedCount} label="매칭된 지원사업" />
      <StatCard icon={Bookmark} value={savedCount} label="저장한 지원사업" />
      <StatCard
        icon={AlarmClock}
        value={deadlineSoonCount}
        label="마감임박 (7일 이내)"
        accent={deadlineSoonCount > 0}
      />
    </div>
  );
}
