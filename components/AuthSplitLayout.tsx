import Image from 'next/image';

/** Make.com-style split auth layout: form column on the left, full-bleed brand
 *  panel on the right (desktop only — collapses to a single centered column with
 *  the logo on top below lg). Form content stays in the pages; this only owns
 *  the chrome. */
export function AuthSplitLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Left — form column */}
      <div className="flex w-full flex-col justify-center px-md py-section-lg lg:w-1/2 lg:px-xxl">
        <div className="mx-auto flex w-full max-w-[400px] flex-col">
          {/* Logo lives on the brand panel on desktop; keep it here on mobile where
              the panel is hidden. */}
          <p className="mb-xxl text-heading-sm font-semibold tracking-tight text-ink lg:hidden">
            eunwon
          </p>
          <h1 className="text-heading-lg text-ink">{title}</h1>
          <p className="mb-xxl mt-sm text-subtitle text-steel">{description}</p>
          {children}
        </div>
      </div>

      {/* Right — brand panel (desktop only) */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-blue to-brand-blue-deep p-xxl lg:flex">
        {/* Oversized decorative quote marks, echoing the source design's quote layout */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-xxl top-section-sm select-none text-[160px] leading-none text-white/15"
        >
          &ldquo;
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-section-sm right-xxl select-none text-[160px] leading-none text-white/15"
        >
          &rdquo;
        </span>

        <p className="text-right text-heading-sm font-semibold tracking-tight text-on-dark">
          eunwon
        </p>

        <div className="relative flex flex-1 items-center px-xxl">
          <p className="text-heading-lg text-on-dark">
            1,600여 개 정부지원사업 중
            <br />
            우리 사업에 맞는 것만 골라 드릴게요
          </p>
        </div>

        {/* Mascot peeking up from the bottom edge — the panel's overflow-hidden clips
            the lower half of the image so only the upper body shows. */}
        <Image
          src="/mascot/thumbs-up.png"
          alt="eunwon 마스코트"
          width={360}
          height={360}
          className="pointer-events-none absolute -bottom-[140px] left-1/2 -translate-x-1/2"
        />
      </aside>
    </div>
  );
}
