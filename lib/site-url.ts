const configuredUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://eunwon.com';

export const SITE_URL = configuredUrl.replace(/\/$/, '');
