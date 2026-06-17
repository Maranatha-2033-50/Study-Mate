'use client';

import Link from 'next/link';
import { useState } from 'react';

/* ────────────────────────────────────────────────────────────────────────────
   스터디메이트 정식 브랜드 간판
   - 좌측 마크는 public/logo.png 를 우선 사용하고, 파일이 없거나 로드 실패 시에만
     그라디언트 배지로 방어적 폴백한다(이미지 없을 때만 대체 표시).
   - 우측 "스터디메이트" 워드마크는 항상 노출해 브랜드명을 보장한다.
──────────────────────────────────────────────────────────────────────────── */
export function BrandLogo({ href = '/' }: { href?: string }) {
  const [imgOk, setImgOk] = useState(true);

  return (
    <Link href={href} className="group flex items-center gap-2.5">
      {imgOk ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/logo.png"
          alt="스터디메이트"
          onError={() => setImgOk(false)}
          className="h-8 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-xl
                     bg-gradient-to-br from-indigo-600 to-violet-600 shadow-sm
                     ring-1 ring-inset ring-white/20 transition-transform duration-200
                     group-hover:scale-105"
        >
          <span className="text-sm font-black tracking-tighter text-white">S</span>
        </span>
      )}

      <span className="text-[17px] font-extrabold tracking-tight text-slate-900">
        스터디메이트
      </span>
    </Link>
  );
}
