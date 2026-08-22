// Every account gets full Pro features free for TRIAL_MONTHS from signup,
// independent of the `profiles.subscription` column (which only reflects a
// real paid Toss subscription). Trial status is derived, not stored — it's
// computed off auth.users.created_at (already returned by
// supabase.auth.getUser()) so no schema change or expiry cron is needed: the
// trial simply stops applying once the window has passed.
//
// Kept deliberately separate from `subscription` so the billing/charge cron
// (app/api/cron/charge-subscriptions/route.ts) — which must only ever charge
// real paid subscribers — doesn't need to know trials exist.

export const TRIAL_MONTHS = 3;

export function getTrialEndsAt(userCreatedAt: string): Date {
  const end = new Date(userCreatedAt);
  end.setMonth(end.getMonth() + TRIAL_MONTHS);
  return end;
}

export function isInTrial(userCreatedAt: string): boolean {
  return getTrialEndsAt(userCreatedAt).getTime() > Date.now();
}

/** Days remaining in the trial window, floored at 0. Meaningless once the trial has ended. */
export function trialDaysLeft(userCreatedAt: string): number {
  const ms = getTrialEndsAt(userCreatedAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export type PlanStatus = 'pro' | 'trial' | 'free';

export function getPlanStatus(subscription: string, userCreatedAt: string): PlanStatus {
  if (subscription === 'pro') return 'pro';
  if (isInTrial(userCreatedAt)) return 'trial';
  return 'free';
}

/** Whether this account should see Pro-gated features right now — real subscription or active trial. */
export function isProUser(subscription: string, userCreatedAt: string): boolean {
  return getPlanStatus(subscription, userCreatedAt) !== 'free';
}

/** Warn once, somewhere in the last week of the trial — never after it's ended, never twice. */
export const TRIAL_WARNING_WINDOW_DAYS = 7;

export function shouldWarnTrialEnding(
  subscription: string,
  userCreatedAt: string,
  trialEndingNotifiedAt: string | null
): boolean {
  if (trialEndingNotifiedAt != null) return false;
  if (getPlanStatus(subscription, userCreatedAt) !== 'trial') return false;
  return trialDaysLeft(userCreatedAt) <= TRIAL_WARNING_WINDOW_DAYS;
}
