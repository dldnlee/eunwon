// eunwon (은원 — 은 "silver" + 원 "circle") wordmark: two overlapping circles,
// brand-blue-mid over ink, matching the founder's provided logo.
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 56 32"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="eunwon"
    >
      <circle cx="18" cy="16" r="16" fill="#3b82f6" />
      <circle cx="38" cy="16" r="16" fill="#0a0a0a" />
    </svg>
  );
}
