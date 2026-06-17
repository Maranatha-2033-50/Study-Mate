'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  PORTAL_DOMAINS,
  DOMAIN_HOME,
  DOMAIN_COOKIE,
  DOMAIN_COOKIE_MAX_AGE,
  type DomainMode,
} from '@/lib/domain';

/* 관문 클릭 → 도메인 모드를 쿠키에 주입.
   (student) 서버 레이아웃이 이 쿠키로 GNB 세부 종목 탭을 구성하고,
   미로그인 시 /login?next=<도메인 홈> 으로 분기시킨다. */
function selectDomain(mode: DomainMode) {
  document.cookie = `${DOMAIN_COOKIE}=${mode}; path=/; max-age=${DOMAIN_COOKIE_MAX_AGE}; samesite=lax`;
}

export default function PortalPage() {
  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-slate-900 md:flex-row">
      {PORTAL_DOMAINS.map((d) => (
        <Link
          key={d.mode}
          href={DOMAIN_HOME[d.mode]}
          onClick={() => selectDomain(d.mode)}
          className="group relative flex flex-1 basis-0 items-center justify-center overflow-hidden
                     transition-[flex-grow] duration-500 ease-out md:hover:flex-[1.6]"
        >
          {/* 폴백 그라디언트 (이미지 로딩 실패 시에도 프리미엄 톤 유지) */}
          <div className={`absolute inset-0 bg-gradient-to-br ${d.gradient}`} />

          {/* 배경 스탁 이미지 — 기본 grayscale + 다크, hover 시 풀컬러 */}
          <img
            src={d.image}
            alt=""
            aria-hidden
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            className="absolute inset-0 h-full w-full object-cover
                       grayscale brightness-[0.55] saturate-50
                       transition-all duration-500 ease-out
                       group-hover:grayscale-0 group-hover:brightness-90 group-hover:saturate-100
                       group-hover:scale-105"
          />

          {/* 가독성 오버레이 — hover 시 옅어짐 */}
          <div className="absolute inset-0 bg-slate-950/40 transition-opacity duration-500 group-hover:bg-slate-950/20" />

          {/* 콘텐츠 */}
          <div className="relative z-10 px-8 text-center text-white">
            <h2 className="text-2xl font-extrabold leading-tight drop-shadow-md sm:text-3xl lg:text-4xl">
              {d.gate}
            </h2>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-white/75">
              {d.tagline}
            </p>
            <span
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/40
                         px-5 py-2.5 text-sm font-semibold backdrop-blur-sm
                         opacity-0 translate-y-2 transition-all duration-500
                         group-hover:opacity-100 group-hover:translate-y-0
                         group-hover:bg-white group-hover:text-slate-900"
            >
              입장하기
              <ArrowRight size={16} />
            </span>
          </div>
        </Link>
      ))}
    </main>
  );
}
