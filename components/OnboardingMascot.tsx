import { cn } from '@/lib/utils';

// A deliberately simple placeholder mascot — a friendly face built from the
// same three tones as the eunwon mark (public/logo-mark.png: gray, blue,
// black tangent circles). Meant to be swapped for a real illustration later
// without touching the call sites: everything here is one inline SVG behind
// a small pose prop, no external asset.
//
// - "wave" — raised, wiggling hand. Used once on the onboarding welcome screen.
// - "point" — lowered, static hand. Used alongside the per-step guidance bubble.
export function OnboardingMascot({
  pose = 'point',
  animate = true,
  className,
}: {
  pose?: 'wave' | 'point';
  animate?: boolean;
  className?: string;
}) {
  const isWave = pose === 'wave';

  return (
    <svg
      viewBox="0 0 100 100"
      className={cn('shrink-0', className)}
      role="img"
      aria-label={isWave ? '손을 흔들며 인사하는 마스코트' : '안내하는 마스코트'}
    >
      {/* ground shadow */}
      <ellipse cx="50" cy="88" rx="20" ry="4" className="fill-ink opacity-[0.08]" />

      {/* arm + hand — drawn first so it sits behind the head at the shoulder */}
      <g
        style={{ transformOrigin: '66px 62px' }}
        className={cn(isWave && animate && 'animate-mascot-wave')}
      >
        {isWave ? (
          <>
            <line x1="66" y1="62" x2="82" y2="38" className="stroke-stone" strokeWidth="4" strokeLinecap="round" />
            <circle cx="85" cy="34" r="8" className="fill-brand-blue-mid" />
          </>
        ) : (
          <>
            <line x1="66" y1="64" x2="80" y2="80" className="stroke-stone" strokeWidth="4" strokeLinecap="round" />
            <circle cx="83" cy="84" r="7" className="fill-brand-blue-mid" />
          </>
        )}
      </g>

      {/* head */}
      <circle cx="46" cy="52" r="32" className="fill-hairline stroke-stone" strokeWidth="1.5" />

      {/* blush */}
      <circle cx="26" cy="58" r="4.5" className="fill-brand-blue-mid opacity-30" />
      <circle cx="60" cy="58" r="4.5" className="fill-brand-blue-mid opacity-30" />

      {/* eyes */}
      <circle cx="36" cy="46" r="3.5" className="fill-ink" />
      <circle cx="56" cy="46" r="3.5" className="fill-ink" />

      {/* smile */}
      <path
        d="M 34 60 Q 46 68 58 60"
        className="stroke-ink"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
