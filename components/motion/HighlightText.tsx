'use client';

import { motion } from 'motion/react';

/** Pops the wrapped text in, then draws an underline in beneath it — used to give the "eunwon"
 *  brand mention in the hero heading its own animated moment. The underline sits below the text
 *  rather than behind it, avoiding any z-index/stacking games a behind-text highlight bar would
 *  need. */
export function HighlightText({
  children,
  delay = 0.5,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <span className={`relative inline-block whitespace-nowrap ${className ?? ''}`}>
      <motion.span
        className="inline-block"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.span>
      <motion.span
        aria-hidden="true"
        className="absolute inset-x-0 -bottom-1 h-[3px] rounded-full bg-brand-blue-mid sm:h-1.5"
        style={{ originX: 0 }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6, delay: delay + 0.35, ease: [0.16, 1, 0.3, 1] }}
      />
    </span>
  );
}
