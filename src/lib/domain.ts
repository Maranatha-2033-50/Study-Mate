import type { CategoryType } from '@/types';

/* ────────────────────────────────────────────────────────────────────────────
   도메인 모드 계약 (포탈 ↔ GNB/LNB 공유)
   - 포탈에서 관문 클릭 시 sm_domain 쿠키에 모드를 주입한다.
   - (student) 서버 레이아웃이 이 쿠키를 읽어 GNB 세부 종목 탭을 동적 구성한다.
   - CategoryType('CERT'|'LANG'|'SCHOOL')을 그대로 도메인 모드로 사용한다.
──────────────────────────────────────────────────────────────────────────── */

export type DomainMode = CategoryType;

export const DOMAIN_COOKIE = 'sm_domain';
export const DOMAIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180일

/** 각 도메인의 대시보드(홈) 경로 — LNB '대시보드' 및 로그인 후 복귀 지점 */
export const DOMAIN_HOME: Record<DomainMode, string> = {
  CERT:   '/student/cert',
  LANG:   '/student/lang',
  SCHOOL: '/student/school',
};

export function isDomainMode(v: string | undefined | null): v is DomainMode {
  return v === 'CERT' || v === 'LANG' || v === 'SCHOOL';
}

/* ── 포탈 관문 메타 (3분할 도메인 선택 페이지) ──────────────────────────────
   image: Unsplash 프리뷰(원격). 로딩 실패 시 gradient 배경이 그대로 노출되도록
          포탈에서 onError 가드 처리한다. 추후 전용 비주얼로 교체 가능. */
export interface PortalDomain {
  mode:     DomainMode;
  gate:     string;   // 관문 타이틀
  tagline:  string;   // 한 줄 카피
  image:    string;   // 배경 스탁 이미지 URL
  gradient: string;   // 이미지 폴백/오버레이용 tailwind 그라디언트
}

export const PORTAL_DOMAINS: PortalDomain[] = [
  {
    mode:     'CERT',
    gate:     '자격증 패스 관문',
    tagline:  '합격까지, 데이터가 설계하는 최단 루트',
    image:    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1400&q=80',
    gradient: 'from-violet-700 via-indigo-700 to-slate-900',
  },
  {
    mode:     'LANG',
    gate:     '어학 마스터 관문',
    tagline:  'AI 첨삭으로 완성하는 실전 표현력',
    image:    'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&w=1400&q=80',
    gradient: 'from-sky-700 via-cyan-700 to-slate-900',
  },
  {
    mode:     'SCHOOL',
    gate:     '교과 1등급 관문',
    tagline:  '내신·수능, 약점 단원을 정조준',
    image:    'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1400&q=80',
    gradient: 'from-amber-600 via-orange-600 to-slate-900',
  },
];
