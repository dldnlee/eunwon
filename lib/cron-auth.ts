/** Reject cron requests when the deployment has no usable secret configured. */
export function isAuthorizedCronRequest(request: Request, secret = process.env.CRON_SECRET): boolean {
  if (!secret?.trim()) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}
