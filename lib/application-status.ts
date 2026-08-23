export const SAVED_STATUSES = [
  'considering',
  'preparing',
  'submitted',
  'screening',
  'interview',
  'selected',
  'rejected',
  'withdrawn',
] as const;

export type SavedStatus = (typeof SAVED_STATUSES)[number];

export const STATUS_LABELS: Record<SavedStatus, string> = {
  considering: '검토 중',
  preparing: '준비 중',
  submitted: '신청 완료',
  screening: '심사 중',
  interview: '면접·발표',
  selected: '선정',
  rejected: '미선정',
  withdrawn: '진행 중단',
};

const TERMINAL_STATUSES = new Set<SavedStatus>(['selected', 'rejected', 'withdrawn']);

/** Mirrors the database transition function for client affordances and request validation. */
export function canTransitionSavedStatus(from: SavedStatus, to: SavedStatus): boolean {
  if (from === to) return true;
  if (TERMINAL_STATUSES.has(from)) return to === 'considering';
  return true;
}
