import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { LogOut, LayoutGrid } from 'lucide-react';
import { BrandLogo } from '@/components/layout/BrandLogo';
import { GnbTabs, SchoolMasterFilter, StudentChromeProvider, type CurriculumTreeRow } from '@/components/layout/StudentChrome';
import { DOMAIN_COOKIE, DOMAIN_HOME, isDomainMode, type DomainMode } from '@/lib/domain';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 도메인 게이트: 포탈에서 주입한 sm_domain 쿠키 → 미로그인 시 해당 도메인 홈으로 복귀
  const domainCookie = (await cookies()).get(DOMAIN_COOKIE)?.value;
  const domain: DomainMode = isDomainMode(domainCookie) ? domainCookie : 'CERT';
  if (!user) redirect(`/login?next=${encodeURIComponent(DOMAIN_HOME[domain])}`);

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, name')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'tutor') redirect('/tutor/dashboard');

  // GNB 세부 종목 탭 — 현재 도메인 타입으로 한정 (도메인 간 종목 격리)
  const { data: cats } = await supabase
    .from('learning_categories')
    .select('id, title')
    .eq('type', domain)
    .order('title');

  const categories = cats ?? [];
  const categoryFallback = categories[0]?.id ?? '';
  const initial = (profile?.name ?? 'U').charAt(0).toUpperCase();

  // SCHOOL 마스터 필터용 글로벌 트리 조합 (전 SCHOOL 단원에서 distinct country/grade/stream)
  const schoolTree: CurriculumTreeRow[] = [];
  if (domain === 'SCHOOL') {
    const { data: treeRows } = await supabase
      .from('learning_chapters')
      .select('country, grade_level, stream, learning_categories!inner(type)')
      .eq('learning_categories.type', 'SCHOOL')
      .not('country', 'is', null);
    const seen = new Set<string>();
    for (const r of (treeRows ?? []) as unknown as { country: string; grade_level: string; stream: string }[]) {
      const key = `${r.country}|${r.grade_level}|${r.stream}`;
      if (!seen.has(key)) { seen.add(key); schoolTree.push({ country: r.country, grade: r.grade_level, stream: r.stream }); }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── GNB ── */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-6">
          {/* 좌: 브랜드 간판 + 현재 도메인 세부 종목 탭 */}
          <div className="flex min-w-0 items-center gap-6">
            <BrandLogo href={DOMAIN_HOME[domain]} />
            {/* SCHOOL은 플랫 카테고리 대신 상단 인라인 마스터 필터(국가→학년→목적) */}
            {domain === 'SCHOOL'
              ? <SchoolMasterFilter tree={schoolTree} />
              : <GnbTabs domain={domain} categories={categories} />}
          </div>

          {/* 우: 도메인 변경(포탈) + 사용자 정보 */}
          <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
            {/* 포탈로 워프 — 도메인 자유 변경 동선 */}
            <Link
              href="/"
              aria-label="포탈로 이동 (도메인 변경)"
              title="도메인 변경"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5
                         text-xs font-medium text-slate-500 transition-colors
                         hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
            >
              <LayoutGrid size={15} />
              <span className="hidden sm:inline">도메인 변경</span>
            </Link>

            {/* 이름 클릭 → 마이페이지 */}
            <Link
              href="/student/mypage"
              title="마이페이지"
              className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-slate-100"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100">
                <span className="text-sm font-bold text-indigo-700">{initial}</span>
              </div>
              <span className="hidden text-sm font-medium text-slate-700 sm:block">{profile?.name}</span>
            </Link>

            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-slate-700"
              >
                <LogOut size={13} />
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* ── 페이지 콘텐츠 (LNB/우측 가이드는 허브 페이지가 StudentShell 로 노출) ── */}
      <StudentChromeProvider value={{ domain, categoryFallback }}>
        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      </StudentChromeProvider>
    </div>
  );
}
