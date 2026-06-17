'use client';

import { createContext, useContext, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Menu, X, Lightbulb, HelpCircle, Clock, Sparkles,
  LayoutDashboard, ClipboardCheck, Target, NotebookPen, CalendarClock,
} from 'lucide-react';
import { DOMAIN_META, DOMAIN_HOME, type DomainMode, type DomainGuideTip } from '@/lib/domain';
import { useCurriculumStore } from '@/stores/curriculumStore';

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

/* ── SCHOOL 전용 GNB: 플랫 카테고리 쿼리 대신 CurriculumExplorer가 publish한
   세부 과목(Course)을 동적 탭으로 노출. 클릭 시 카드 필터(activeCourse) 동기화. ── */
export function SchoolGnbTabs() {
  const courses = useCurriculumStore((s) => s.courses);
  const active = useCurriculumStore((s) => s.activeCourse);
  const setActiveCourse = useCurriculumStore((s) => s.setActiveCourse);

  if (courses.length === 0) {
    return (
      <span className="hidden whitespace-nowrap text-xs font-medium text-slate-400 sm:inline">
        하단 글로벌 교과 탐색에서 국가·학년·목적을 선택하세요
      </span>
    );
  }

  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      <button
        onClick={() => setActiveCourse(null)}
        className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors
          ${active === null ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'}`}
      >
        전체
      </button>
      {courses.map((c) => {
        const isActive = c === active;
        return (
          <button
            key={c}
            onClick={() => setActiveCourse(c)}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors
              ${isActive ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'}`}
          >
            {c}
          </button>
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
  { key: 'incorrect', label: '오답 보관함',      icon: NotebookPen,     route: () => '/student/incorrect',        match: (p: string) => p.startsWith('/student/incorrect') || p.startsWith('/student/support') },
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

/* ── 우측 가이드 패널: 활성 LNB 메뉴를 실시간 구독해 콘텐츠 스위칭 ──────────
   pathname 기반으로 활성 메뉴 키를 산출 → 메뉴별 가이드로 동적 전환.
   '대시보드'는 도메인 개요(DOMAIN_META)를 그대로 노출한다. */
const GUIDE_ICONS = { HelpCircle, Clock, Sparkles } as const;

type MenuKey = (typeof LNB_ITEMS)[number]['key'];

function activeMenuKey(pathname: string, domain: DomainMode): MenuKey {
  return LNB_ITEMS.find((i) => i.match(pathname, domain))?.key ?? 'dashboard';
}

/* 메뉴별 가이드 (dashboard 는 null → 도메인 개요 사용) */
const MENU_GUIDE: Record<MenuKey, { title: string; tips: DomainGuideTip[] } | null> = {
  dashboard: null,
  mock: {
    title: '실전 모의고사 가이드',
    tips: [
      { icon: 'HelpCircle', title: '모의고사란?', body: '실제 시험과 동일한 구성으로 출제 범위를 점검합니다. 단원별 세트를 골라 실전 감각을 끌어올리세요.' },
      { icon: 'Clock',      title: '시간 관리',   body: '타이머가 작동하는 실전 룸입니다. 문항별 페이스를 기록해 시간 배분 전략을 다듬으세요.' },
      { icon: 'Sparkles',   title: '결과 활용',   body: '응시 직후 취약 단원이 자동 분석되어 대시보드와 AI 플래너에 반영됩니다.' },
    ],
  },
  training: {
    title: '취약단원 훈련방 가이드',
    tips: [
      { icon: 'HelpCircle', title: '작동 원리',     body: 'AI가 오답·정답률을 분석해 가장 약한 단원의 문제를 실시간으로 출제합니다.' },
      { icon: 'Clock',      title: 'COUNT vs TIME', body: '문항 수(COUNT) 또는 제한 시간(TIME) 챌린지를 선택해 집중 모드로 훈련하세요.' },
      { icon: 'Sparkles',   title: '반복의 힘',     body: '약점은 짧게 자주 반복할 때 가장 빨리 메워집니다. 매일 10문항을 권장합니다.' },
    ],
  },
  incorrect: {
    title: '오답 보관함 · 망각곡선 가이드',
    tips: [
      { icon: 'Clock',      title: '망각곡선 복습 주기', body: '틀린 직후·1일·3일·7일 간격으로 다시 풀 때 장기 기억으로 굳어집니다.' },
      { icon: 'HelpCircle', title: '자동 적립',         body: '모의고사·훈련방에서 틀린 문제가 자동으로 모입니다. 최신 시도가 정답이면 정복 처리되어 사라집니다.' },
      { icon: 'Sparkles',   title: '재도전',            body: '보관함에서 바로 재응시해 오답을 정답으로 전환하세요.' },
    ],
  },
  planner: {
    title: 'AI 플래너 활용법',
    tips: [
      { icon: 'HelpCircle', title: '사용법',        body: '목표 시험일(D-Day)과 요일별 가용 시간을 입력하면, AI가 확보 시간 예산에 맞춰 로드맵을 설계합니다.' },
      { icon: 'Clock',      title: 'Study Budget',  body: '주간 가용 시간 × 남은 일수 = 총 학습 예산. 예산 안에서 취약 단원에 가중치를 둬 배분합니다.' },
      { icon: 'Sparkles',   title: '마일스톤 체크', body: '마일스톤을 체크하면 진행률이 대시보드 페이스메이커 배너에 실시간 반영됩니다.' },
    ],
  },
};

function GuidePanel() {
  const { domain } = useChrome();
  const pathname = usePathname();
  const meta = DOMAIN_META[domain];

  const menu = MENU_GUIDE[activeMenuKey(pathname, domain)];
  const title = menu ? menu.title : `${meta.label} 학습 가이드`;
  const tips  = menu ? menu.tips  : meta.tips;

  return (
    <div className="space-y-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Lightbulb className="text-indigo-500" size={16} />
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
      </div>
      {tips.map((tip) => {
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
