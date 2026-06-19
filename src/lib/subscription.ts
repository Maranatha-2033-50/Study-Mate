import type { SubscriptionStatus } from '@/types';

/* ── 3개 등급 과금 가드 — 권한·한도 단일 출처 (Phase 13) ──────────────────────────
   학생 기능의 이용 권한을 등급별로 차등 제어하는 정책을 한 곳에 모은다.
   클라이언트 게이트(시험/훈련/질문 진입)와 서버 판정이 같은 표를 공유하도록 isomorphic. */

export type SubscriptionTier = SubscriptionStatus;  // 'BASIC' | 'PLUS' | 'PREMIUM'

export interface TierLimit {
  /** 진단·모의고사 누적 응시 허용 횟수 (Infinity = 무제한) */
  diagnostics: number;
  /** 취약 단원 무한 훈련방 누적 입장 허용 횟수 (Infinity = 무제한) */
  trainings: number;
  /** 오답노트 1:1 과외 툴바([선생님께 질문하기]) 개방 여부 */
  tutorQna: boolean;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimit> = {
  // 무료 — 맛보기: 최초 진단 1회 + 취약 훈련방 1회권 (AI 플래너는 전 등급 허용)
  BASIC:   { diagnostics: 1,        trainings: 1,        tutorQna: false },
  // 본격 학습 — 실전 모의고사·훈련방 무제한 (1:1 과외 툴바는 차단)
  PLUS:    { diagnostics: Infinity, trainings: Infinity, tutorQna: false },
  // 최고 등급 — 모든 AI 피처 무제한 + 1:1 튜터 Q&A 개방
  PREMIUM: { diagnostics: Infinity, trainings: Infinity, tutorQna: true  },
};

export const TIER_LABEL: Record<SubscriptionTier, string> = {
  BASIC: 'BASIC', PLUS: 'PLUS', PREMIUM: 'PREMIUM',
};

/** 동적 페이월 유도 카피 (초과 시 모달 본문) */
export const PAYWALL_MESSAGE =
  '해당 기능은 현재 등급에서 초과되었습니다. 마이페이지에서 구독을 업그레이드하고 무한 성장해 보세요!';

/* DB 값/레거시 값을 안전한 등급으로 정규화.
   016 마이그레이션 적용 전 잔존할 수 있는 'FREE_TRIAL' 및 미설정 값은 BASIC 으로 수렴한다. */
export function normalizeTier(raw: string | null | undefined): SubscriptionTier {
  if (raw === 'PREMIUM') return 'PREMIUM';
  if (raw === 'PLUS') return 'PLUS';
  return 'BASIC';   // 'BASIC' | 'FREE_TRIAL' | null | 그 외
}

export const canStartDiagnostic = (tier: SubscriptionTier, usedCount: number): boolean =>
  usedCount < TIER_LIMITS[tier].diagnostics;

export const canStartTraining = (tier: SubscriptionTier, usedCount: number): boolean =>
  usedCount < TIER_LIMITS[tier].trainings;

export const canUseTutorQna = (tier: SubscriptionTier): boolean =>
  TIER_LIMITS[tier].tutorQna;
