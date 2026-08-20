import Image from 'next/image';

// eunwon (은원 — 은 "silver" + 원 "circle") mark: two overlapping circles,
// cropped from the founder-provided asset (public/logo-mark.png).
export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/logo-mark.png"
      alt="eunwon"
      width={150}
      height={75}
      className={className}
    />
  );
}
