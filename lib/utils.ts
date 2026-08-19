import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

/** Business age in whole months, from a founding date to now. */
export function getAgeMonths(foundedAt: string | Date | null): number {
  if (!foundedAt) return 0;
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

export function formatAmount(amountText: string | null, amountMax: number | null): string {
  if (amountText) return amountText;
  if (amountMax) return `최대 ${(amountMax / 10_000).toLocaleString()}만원`;
  return '금액 미공개';
}

export function formatKoreanDate(dateStr: string | null): string {
  if (!dateStr) return '상시';
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}
