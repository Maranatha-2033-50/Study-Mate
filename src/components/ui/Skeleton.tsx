/* 재사용 스켈레톤 블록 — AI 응답 지연 동안 레이아웃 자리를 잡아 화면이 멈춰 보이지 않게 한다. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/70 ${className}`} />;
}

/* 에세이 첨삭 결과용 스켈레톤 (점수 배지 + 영역 카드 + 첨삭 줄) */
export function EssayFeedbackSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-36 w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
      </div>
      <p className="text-center text-sm font-medium text-indigo-500">AI가 첨삭 리포트를 작성하고 있어요…</p>
    </div>
  );
}
