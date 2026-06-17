'use client';

import { createContext, useContext, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Menu, X, Lightbulb, HelpCircle, Clock, Sparkles,
  LayoutDashboard, ClipboardCheck, Target, NotebookPen, CalendarClock,
} from 'lucide-react';
import { DOMAIN_META, DOMAIN_HOME, type DomainMode } from '@/lib/domain';

/* ────────────────────────────────────────────────────────────────────────────
   학생 화면 크롬(Chrome) 공유 계약
   - (student) 레이아웃이 도메인/기본 카테고리를 컨텍스트로 내려준다.
   - GNB(세부 종목 탭)는 레이아웃에서 직접 렌더, LNB+우측 가이드는 허브 페이지가
     StudentShell 로 콘텐츠를 감싸 노출한다(몰입형 시험방은 감싸지 않음).
──────────────────────────────────────────────────────────────────────────── */

interface ChromeValue {
  domain:           DomainMode;
  categoryFallback: string;     // URL에 ?category= 가 없을 때 사용할 도메인 첫 카테고리
}

const ChromeCtx = createContext<ChromeValue | null>(null);

export function StudentChromeProvider({
  value,
  children,
}: {
  value: ChromeValue;
  children: React.ReactNode;
}) {
  return <ChromeCtx.Provider value={value}>{children}</ChromeCtx.Provider>;
}

function useChrome(): ChromeValue {
  const v = useContext(ChromeCtx);
  if (!v) throw new Error('StudentShell/GuidePanel must be used within StudentChromeProvider');
  return v;
}

/* ── GNB: 현재 도메인의 세부 종목 탭 ─────────────────────────────────────────
   레이아웃(서버)에서 도메인 한정 카테고리 목록을 받아 동적 렌더. */
export function GnbTabs({
  domain,
  categories,
}: {
  domain: DomainMode;
  categories: { id: string; title: string }[];
}) {
  const searchParams = useSearchParams();
  const active = searchParams.get('category') ?? categories[0]?.id ?? '';
  const base = DOMAIN_HOME[domain];

  if (categories.length === 0) return null;

  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {categories.map((cat) => {
        const isActive = cat.id === active;
        return (
          <Link
            key={cat.id}
            href={`${base}?category=${cat.id}`}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors
              ${isActive
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'}`}
          >
            {cat.title}
          </Link>
        );
      })}
    </nav>
  );
}

/* ── LNB: 프리미엄 5대 코어 메뉴 (고정 순서) ─────────────────────────────── */
const LNB_ITEMS = [
  { key: 'dashboard', label: '대시보드',        icon: LayoutDashboard, route: (d: DomainMode) => DOMAIN_HOME[d], match: (p: string, d: DomainMode) => p === DOMAIN_HOME[d] },
  { key: 'mock',      label: '실전 모의고사',    icon: ClipboardCheck,  route: () => '/student/diagnostic',       match: (p: string) => p.startsWith('/student/diagnostic') },
  { key: 'training',  label: '취약단원 훈련방',  icon: Target,          route: () => '/student/training',         match: (p: string) => p.startsWith('/student/training') },
  { key: 'incorrect', label: '오답 보관함',      icon: NotebookPen,     route: () => '/student/incorrect',        match: (p: string) => p.startsWith('/student/incorrect') },
  { key: 'planner',   label: 'AI 플래너',        icon: CalendarClock,   route: () => '/student/planner',          match: (p: string) => p.startsWith('/student/planner') },
] as const;

function LnbList({ onNavigate }: { onNavigate?: () => void }) {
  const { domain, categoryFallback } = useChrome();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const category = searchParams.get('category') ?? categoryFallback;
  const suffix = category ? `?category=${category}` : '';

  return (
    <nav className="space-y-1">
      {LNB_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = item.match(pathname, domain);
        return (
          <Link
            key={item.key}
            href={`${item.route(domain)}${suffix}`}
            onClick={onNavigate}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors
              ${active
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'}`}
          >
            <Icon size={16} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/* ── 우측 가이드 패널 (Phase 2: 도메인별 정적 / Phase 4: 메뉴별 동적 예정) ── */
const GUIDE_ICONS = { HelpCircle, Clock, Sparkles } as const;

function GuidePanel() {
  const { domain } = useChrome();
  const meta = DOMAIN_META[domain];
  return (
    <div className="space-y-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Lightbulb className="text-indigo-500" size={16} />
        <h2 className="text-sm font-bold text-slate-800">{meta.label} 학습 가이드</h2>
      </div>
      {meta.tips.map((tip) => {
        const Icon = GUIDE_ICONS[tip.icon];
        return (
          <div key={tip.title} className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Icon size={13} className="text-indigo-400" />
              {tip.title}
            </p>
            <p className="text-xs leading-6 text-slate-500">{tip.body}</p>
          </div>
        );
      })}
    </div>
  );
}

/* ── 허브 페이지 셸: LNB · 중앙 콘텐츠 · 우측 가이드 (모바일 드로어/모달) ── */
export function StudentShell({ children }: { children: React.ReactNode }) {
  const { domain } = useChrome();
  const meta = DOMAIN_META[domain];
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [guideOpen, setGuideOpen]   = useState(false);

  return (
    <div>
      {/* 모바일 컨트롤 바 */}
      <div className="mb-5 flex items-center justify-between lg:hidden">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="메뉴 열기"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        >
          <Menu size={18} />
        </button>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${meta.badge}`}>{meta.label}</span>
        <button
          onClick={() => setGuideOpen(true)}
          aria-label="사용 가이드 열기"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-indigo-500 hover:bg-indigo-50"
        >
          <HelpCircle size={18} />
        </button>
      </div>

      {/* 데스크톱 3단 그리드 */}
      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)_300px] lg:items-start lg:gap-6">
        <aside className="hidden lg:sticky lg:top-24 lg:block">
          <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
            <p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              학습 메뉴
            </p>
            <LnbList />
          </div>
        </aside>

        <div className="min-w-0">{children}</div>

        <aside className="hidden lg:sticky lg:top-24 lg:block">
          <GuidePanel />
        </aside>
      </div>

      {/* 모바일 좌측 LNB 드로어 */}
      <div className={`fixed inset-0 z-50 lg:hidden ${drawerOpen ? '' : 'pointer-events-none'}`}>
        <div
          onClick={() => setDrawerOpen(false)}
          className={`absolute inset-0 bg-slate-900/40 transition-opacity duration-300 ${drawerOpen ? 'opacity-100' : 'opacity-0'}`}
        />
        <div
          className={`absolute left-0 top-0 h-full w-72 max-w-[80%] bg-white p-5 shadow-2xl
                      transition-transform duration-300 ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="mb-4 flex items-center justify-between">
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${meta.badge}`}>학습 메뉴</span>
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label="메뉴 닫기"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
            >
              <X size={16} />
            </button>
          </div>
          <LnbList onNavigate={() => setDrawerOpen(false)} />
        </div>
      </div>

      {/* 모바일 우측 가이드 모달 */}
      {guideOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center lg:hidden"
          onClick={() => setGuideOpen(false)}
        >
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div
            className="relative max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setGuideOpen(false)}
              aria-label="가이드 닫기"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
            >
              <X size={16} />
            </button>
            <GuidePanel />
          </div>
        </div>
      )}
    </div>
  );
}
