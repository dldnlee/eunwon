'use client';

import { MotionConfig } from 'motion/react';

/** Wraps a subtree so every motion.dev animation inside respects the OS-level
 *  prefers-reduced-motion setting, matching the reduced-motion handling already
 *  applied to the CSS keyframe animations elsewhere in the app (see app/globals.css). */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
