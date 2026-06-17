'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, HelpCircle, FileText, Target, NotebookPen } from 'lucide-react';

/* 좌측 서브 내비게이션 아이콘 — 직렬화 가능한 키로 전달받아 매핑 */
const NAV_ICONS = { FileText, Target, NotebookPen } as const;

export interface DomainNavItem {
  href:   string;
  label:  string;
  icon:   keyof typeof NAV_ICONS;
  active?: boolean;
}

interface Props {
  domainLabel: string;          // '자격증' | '어학' | '교과'
  domainBadge: string;          // tailwind 뱃지 색상 클래스
  nav:         DomainNavItem[];  // 좌측 서브 메뉴
  guide:       React.ReactNode;  // 우측 가이드 패널 (서버 렌더 콘텐츠)
  children:    React.ReactNode;  // 중앙 코어 콘텐츠
}

/* 좌측 메뉴 본문 — 데스크톱 사이드바 / 모바일 드로어 공용 */
function NavList({ nav, onNavigate }: { nav: DomainNavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="space-y-1">
      {nav.map((item) => {
        const Icon = NAV_ICONS[item.icon];
        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
              ${item.active
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

export function DashboardLayout({ domainLabel, domainBadge, nav, guide, children }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [guideOpen, setGuideOpen]   = useState(false);

  return (
    <div>
      {/* ── 모바일 컨트롤 바 (lg 미만) ── */}
      <div className="lg:hidden flex items-center justify-between mb-5">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="메뉴 열기"
          className="w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50"
        >
          <Menu size={18} />
        </button>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${domainBadge}`}>{domainLabel}</span>
        <button
          onClick={() => setGuideOpen(true)}
          aria-label="사용 가이드 열기"
          className="w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-indigo-500 hover:bg-indigo-50"
        >
          <HelpCircle size={18} />
        </button>
      </div>

      {/* ── 데스크톱 3단 컬럼 그리드 (240px / 1fr / 300px) ── */}
      <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)_300px] lg:gap-6 lg:items-start">
        {/* 좌측 서브 내비게이션 — lg 미만 숨김 */}
        <aside className="hidden lg:block lg:sticky lg:top-24">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
            <p className="px-3 pt-1 pb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              {domainLabel} 메뉴
            </p>
            <NavList nav={nav} />
          </div>
        </aside>

        {/* 중앙 코어 콘텐츠 */}
        <div className="min-w-0">{children}</div>

        {/* 우측 가이드 패널 — lg 미만 숨김 */}
        <aside className="hidden lg:block lg:sticky lg:top-24">{guide}</aside>
      </div>

      {/* ── 모바일 좌측 드로어 (항상 마운트 → 부드러운 슬라이드) ── */}
      <div className={`fixed inset-0 z-50 lg:hidden ${drawerOpen ? '' : 'pointer-events-none'}`}>
        <div
          onClick={() => setDrawerOpen(false)}
          className={`absolute inset-0 bg-slate-900/40 transition-opacity duration-300 ${drawerOpen ? 'opacity-100' : 'opacity-0'}`}
        />
        <div
          className={`absolute left-0 top-0 h-full w-72 max-w-[80%] bg-white shadow-2xl p-5
                      transition-transform duration-300 ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="flex items-center justify-between mb-4">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${domainBadge}`}>{domainLabel} 메뉴</span>
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label="메뉴 닫기"
              className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400"
            >
              <X size={16} />
            </button>
          </div>
          <NavList nav={nav} onNavigate={() => setDrawerOpen(false)} />
        </div>
      </div>

      {/* ── 모바일 우측 가이드 오버레이 모달 ── */}
      {guideOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex items-end sm:items-center justify-center p-4"
          onClick={() => setGuideOpen(false)}
        >
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setGuideOpen(false)}
              aria-label="가이드 닫기"
              className="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400"
            >
              <X size={16} />
            </button>
            {guide}
          </div>
        </div>
      )}
    </div>
  );
}
