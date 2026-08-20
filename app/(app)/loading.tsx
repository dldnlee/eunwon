export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <span
        role="status"
        aria-label="불러오는 중"
        className="h-8 w-8 animate-spin rounded-full border-2 border-hairline border-t-ink"
      />
    </div>
  );
}
