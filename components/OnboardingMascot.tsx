import Image from 'next/image';
import { cn } from '@/lib/utils';

const POSES = {
  wave: { src: '/mascot/wave.png', alt: '손을 흔들며 인사하는 은원 마스코트' },
  point: { src: '/mascot/thumbs-up.png', alt: '입력을 응원하는 은원 마스코트' },
  thinking: { src: '/mascot/thinking.png', alt: '지원사업을 살펴보는 은원 마스코트' },
} as const;

export function OnboardingMascot({
  pose = 'point',
  animate = true,
  className,
}: {
  pose?: keyof typeof POSES;
  animate?: boolean;
  className?: string;
}) {
  const { src, alt } = POSES[pose];

  return (
    <Image
      src={src}
      alt={alt}
      width={256}
      height={256}
      sizes="(max-width: 640px) 96px, 128px"
      className={cn(
        'shrink-0 object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.08)]',
        animate && pose === 'wave' && 'animate-mascot-wave',
        className
      )}
    />
  );
}
