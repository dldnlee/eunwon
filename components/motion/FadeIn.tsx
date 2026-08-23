'use client';

import { motion, type Variants } from 'motion/react';

const TAGS = {
  div: motion.div,
  span: motion.span,
  header: motion.header,
  section: motion.section,
  li: motion.li,
} as const;

type FadeInTag = keyof typeof TAGS;

const VARIANTS: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

/**
 * Shared entrance animation for the homepage — fades up once when it scrolls into view.
 * Renders directly as the requested tag (no wrapping element) so it can safely stand in for
 * things like the fixed nav `<header>` — wrapping a `position: fixed` element in an animated
 * container would give that wrapper a `transform`, which turns it into the containing block for
 * fixed descendants and breaks the "stays pinned while scrolling" behavior.
 * `once: true` so re-scrolling past a section never replays it, and motion.dev's `reducedMotion`
 * config (see MotionProvider) skips the animation entirely for prefers-reduced-motion users.
 */
export function FadeIn({
  children,
  delay = 0,
  className,
  id,
  ariaLabel,
  as = 'div',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  id?: string;
  ariaLabel?: string;
  as?: FadeInTag;
}) {
  const MotionTag = TAGS[as];

  return (
    <MotionTag
      id={id}
      aria-label={ariaLabel}
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={VARIANTS}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </MotionTag>
  );
}
