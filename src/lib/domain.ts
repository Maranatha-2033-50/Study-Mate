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
    tagline:  '맞춤형 진단부터 목표 달성까지, 글로벌 공인 어학 완성',
    image:    'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&w=1400&q=80',
    gradient: 'from-sky-700 via-cyan-700 to-slate-900',
  },
  {
    mode:     'SCHOOL',
    gate:     '국내외 교과 과정 관문',
    tagline:  '글로벌 표준 및 국내외 교과 취약점 정밀 케어',
    image:    'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1400&q=80',
    gradient: 'from-amber-600 via-orange-600 to-slate-900',
  },
];

/* ── 도메인별 UI 메타 (대시보드/사이드바/가이드 공용) ──────────────────────────
   기존 DomainDashboard 의 DOMAIN_META 를 공유 위치로 승격해 GNB/LNB/우측 가이드가
   동일한 라벨·색상·가이드 카피를 참조하도록 단일화한다. */
export interface DomainGuideTip {
  icon: 'HelpCircle' | 'Clock' | 'Sparkles';
  title: string;
  body: string;
}

export interface DomainMeta {
  label:      string;   // '자격증' | '어학' | '교과'
  badge:      string;   // tailwind 뱃지 색상
  accentFrom: string;
  accentTo:   string;
  tips:       DomainGuideTip[];
}

export const DOMAIN_META: Record<DomainMode, DomainMeta> = {
  CERT: {
    label: '자격증',
    badge: 'bg-violet-100 text-violet-600',
    accentFrom: 'from-violet-500',
    accentTo: 'to-indigo-500',
    tips: [
      { icon: 'HelpCircle', title: '이 페이지 사용법', body: '실전 모의고사로 출제 범위를 점검하고, 취약 단원 훈련방에서 약점을 집중 보강하세요. 틀린 문제는 오답 보관함에 자동 적립됩니다.' },
      { icon: 'Clock',      title: '망각곡선 복습 주기', body: '자격증 개념은 1일·3일·7일 간격으로 재복습할 때 장기 기억으로 굳어집니다. 오답 보관함을 주기에 맞춰 다시 풀어 보세요.' },
      { icon: 'Sparkles',   title: 'AI 활용 팁', body: 'AI 플래너에 시험일과 가용 시간을 입력하면, 취약 단원 가중치를 반영한 합격 로드맵을 자동 설계합니다.' },
    ],
  },
  LANG: {
    label: '어학',
    badge: 'bg-sky-100 text-sky-600',
    accentFrom: 'from-sky-500',
    accentTo: 'to-cyan-500',
    tips: [
      { icon: 'HelpCircle', title: '이 페이지 사용법', body: '영역(Reading·Listening·Writing)별 모의고사로 실전 감각을 키우고, AI 첨삭이 붙는 에세이 과제로 표현력을 다듬으세요.' },
      { icon: 'Clock',      title: '망각곡선 복습 주기', body: '어휘·표현은 짧고 자주가 핵심입니다. 매일 10분씩 오답 보관함의 표현을 소리 내어 복습하면 인출 강도가 올라갑니다.' },
      { icon: 'Sparkles',   title: 'AI 활용 팁', body: 'Writing 과제는 AI 첨삭 리포트의 문장별 교정 이유까지 읽어야 같은 실수를 반복하지 않습니다.' },
    ],
  },
  SCHOOL: {
    label: '교과',
    badge: 'bg-amber-100 text-amber-600',
    accentFrom: 'from-amber-500',
    accentTo: 'to-orange-500',
    tips: [
      { icon: 'HelpCircle', title: '이 페이지 사용법', body: '커리큘럼 트랙(국내 내신·수능, A-Level 등)별 모의고사를 골라 풀고, 취약 단원 훈련방에서 등급 상승을 노려 보세요.' },
      { icon: 'Clock',      title: '망각곡선 복습 주기', body: '내신·수능 개념은 단원이 끝난 직후, 그리고 시험 2주 전 집중 회독 시 정착률이 가장 높습니다.' },
      { icon: 'Sparkles',   title: 'AI 활용 팁', body: 'AI 플래너가 단원별 약점과 D-Day를 결합해 회독 일정을 배분합니다. 시험 범위가 확정되면 바로 재설정하세요.' },
    ],
  },
};
