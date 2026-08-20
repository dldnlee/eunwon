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

/** Days remaining until a deadline date string (YYYY-MM-DD). Negative if past. */
export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const deadline = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  return Math.round((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatKoreanDate(dateStr: string | null): string {
  if (!dateStr) return '상시';
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}
