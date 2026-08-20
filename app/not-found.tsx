import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-md bg-canvas p-md text-center">
      <SearchX className="h-10 w-10 text-stone" aria-hidden="true" />
      <h1 className="text-heading-sm text-ink">페이지를 찾을 수 없어요</h1>
      <p className="max-w-sm text-body-sm text-steel">
        요청하신 페이지가 삭제되었거나 주소가 잘못되었어요.
      </p>
      <Link href="/dashboard">
        <Button>대시보드로 이동</Button>
      </Link>
    </div>
  );
}
