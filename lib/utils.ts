import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge doesn't know our DESIGN.md type-scale tokens (heading-md, button-md, ...)
// are font-size utilities, not colors — without this it treats `text-heading-md` as
// conflicting with color classes like `text-ink` (both are `text-{word}`) and silently
// drops one of them. Registering the scale here keeps size + color classes independent.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'hero-display',
            'display-lg',
            'heading-lg',
            'heading-md',
            'heading-sm',
            'card-title',
            'subtitle',
            'body-md',
            'body-sm',
            'caption',
            'micro',
            'button-md',
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Strip HTML tags and decode common entities — used on raw API description fields. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Business age in whole months, from a founding date to now. Not a DB generated
 * column (Postgres requires generated-column expressions to be IMMUTABLE, and
 * anything touching "now" is only STABLE) — instead this is called wherever
 * profiles.age_months is written, so it stays current as of that write.
 */
export function getAgeMonths(foundedAt: string | Date | null): number | null {
  if (!foundedAt) return null;
  const founded = typeof foundedAt === 'string' ? new Date(foundedAt) : foundedAt;
  const now = new Date();
  return (
    (now.getFullYear() - founded.getFullYear()) * 12 +
    (now.getMonth() - founded.getMonth())
  );
}

const koreanCalendar = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Korean calendar days until a date-only deadline (YYYY-MM-DD). Negative if past. */
export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const today = Object.fromEntries(
    koreanCalendar.formatToParts(new Date()).map(({ type, value }) => [type, value])
  );
  // Represent both calendar dates at UTC midnight only for arithmetic. Using
  // host-local midnight shifts date-only deadlines and disagrees across SSR/browser.
  const todayMs = Date.UTC(Number(today.year), Number(today.month) - 1, Number(today.day));
  return Math.round((Date.parse(dateStr) - todayMs) / 86_400_000);
}

export function formatKoreanDate(dateStr: string | null): string {
  if (!dateStr) return '상시';
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// Friendlier display-only label for a program category — the stored value
// (from bizinfo's own classification, e.g. `programs.category`) stays raw so
// filtering/matching logic never has to know about this mapping.
const CATEGORY_LABELS: Record<string, string> = { '금융': '대출·보증' };

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}
