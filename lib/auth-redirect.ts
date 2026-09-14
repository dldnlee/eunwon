/** Accept only local paths from untrusted `next` parameters in any auth flow. */
export function safeAuthRedirectPath(
  value: unknown,
  fallback: '/onboard' | '/dashboard' = '/onboard',
): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    Array.from(value).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  ) {
    return fallback;
  }

  try {
    // Parsing normalizes dot segments before downstream auth-route loop guards.
    const origin = 'https://auth-redirect.invalid';
    const destination = new URL(value, origin);
    // A normalized pathname beginning with // becomes external when used as a redirect.
    if (destination.origin !== origin || destination.pathname.startsWith('//')) return fallback;
    return destination.pathname + destination.search + destination.hash;
  } catch {
    return fallback;
  }
}
