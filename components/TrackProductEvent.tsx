'use client';

import { useEffect, useRef } from 'react';
import { trackProductEvent } from '@/lib/telemetry/client';
import type { ProductEventName } from '@/lib/telemetry/events';

export function TrackProductEvent({ name, properties = {} }: {
  name: ProductEventName;
  properties?: Record<string, string | number | boolean | null>;
}) {
  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackProductEvent(name, properties);
  }, [name, properties]);
  return null;
}
