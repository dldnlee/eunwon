import Image from 'next/image';

// eunwon mark: three tangent circles (gray, blue, black), from the
// founder-provided asset (public/logo-mark.png).
export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/logo-mark.png"
      alt="eunwon"
      width={225}
      height={75}
      className={className}
    />
  );
}
