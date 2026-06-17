import Link from 'next/link';
// import Image from 'next/image';

/* ────────────────────────────────────────────────────────────────────────────
   스터디메이트 정식 브랜드 간판
   - 구형 로고("AI" 배지 + "학습 플랫폼")를 대체한다.
   - 좌측 아이콘 자리는 향후 전용 로고 파일로 즉시 교체할 수 있도록 비워 둔다.
     로고 이미지가 준비되면 아래 PLACEHOLDER 블록을 지우고 <Image> 주석을 해제하세요.
       <Image src="/brand/studymate-logo.svg" alt="스터디메이트" width={32} height={32} priority />
──────────────────────────────────────────────────────────────────────────── */
export function BrandLogo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 group">
      {/* ── 로고 아이콘 플레이스홀더 (전용 이미지 준비 시 <Image>로 스왑) ── */}
      <span
        aria-hidden
        className="flex h-8 w-8 items-center justify-center rounded-xl
                   bg-gradient-to-br from-indigo-600 to-violet-600 shadow-sm
                   ring-1 ring-inset ring-white/20 transition-transform duration-200
                   group-hover:scale-105"
      >
        <span className="text-sm font-black tracking-tighter text-white">S</span>
      </span>

      {/* ── 정식 간판 텍스트 ── */}
      <span className="text-[17px] font-extrabold tracking-tight text-slate-900">
        스터디메이트
      </span>
    </Link>
  );
}
