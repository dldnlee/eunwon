import { Star } from 'lucide-react';
import type { Review } from '@/lib/types';

function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="flex w-80 shrink-0 flex-col gap-sm rounded-xl border border-hairline bg-canvas p-lg shadow-subtle">
      <div className="flex items-center gap-1" aria-label={`평점 ${review.rating}점`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={
              i < review.rating
                ? 'h-4 w-4 fill-brand-coral text-brand-coral'
                : 'h-4 w-4 text-hairline'
            }
            aria-hidden="true"
          />
        ))}
      </div>
      <p className="line-clamp-4 text-body-sm text-charcoal">{review.content}</p>
      <div className="mt-auto pt-xs">
        <p className="text-body-sm-medium text-ink">{review.author_name}</p>
        <p className="text-caption text-stone">{review.business_type}</p>
      </div>
    </div>
  );
}

export function ReviewsMarquee({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) return null;

  return (
    <div className="group flex w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]">
      <div className="flex w-max gap-md pr-md animate-marquee-reverse group-hover:[animation-play-state:paused]">
        {reviews.map((review) => (
          <ReviewCard key={`a-${review.id}`} review={review} />
        ))}
      </div>
      <div className="flex w-max gap-md pr-md animate-marquee-reverse group-hover:[animation-play-state:paused]" aria-hidden="true">
        {reviews.map((review) => (
          <ReviewCard key={`b-${review.id}`} review={review} />
        ))}
      </div>
    </div>
  );
}
