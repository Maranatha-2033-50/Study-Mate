import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeTier, type SubscriptionTier } from '@/lib/subscription';

/* ── 비용 방어용 토큰(크레딧) 밸브 — Phase 13 선제 인프라 ────────────────────────
   Plus/Premium 의 무제한 LLM 호출이 서버 비용으로 폭주하지 않도록, AI 출제기·채점기
   작동 "직전" 유저의 월간 토큰 잔량을 검증하고 차감하는 방어적 밸브.

   현재 단계는 fail-open 스캐폴딩이다:
     - profiles.monthly_tokens_left 가 NULL/미설정이면 무제한으로 간주해 그대로 통과.
     - 컬럼 미적용(016 마이그레이션 전) 등 조회 실패도 통과(현재 UX 무영향).
     - 유한 잔량일 때만 차감하고, 0 미만으로 떨어지면 차단한다.
   결제 퍼널/배치 충전이 TIER_TOKEN_QUOTA 한도로 잔량을 채우는 순간 자동으로 활성 밸브가 된다. */

/** 등급별 월간 토큰 한도 — 결제 금액별 서버 리소스 상한 (충전 시 시드 값). 016 SQL 주석과 동기화. */
export const TIER_TOKEN_QUOTA: Record<SubscriptionTier, number | null> = {
  BASIC:   50_000,    // 무료 — 맛보기 한도
  PLUS:    1_000_000, // 본격 학습
  PREMIUM: 5_000_000, // 최고 등급 (사실상 무제한에 가까운 상한)
};

export interface TokenGuardResult {
  ok: boolean;
  /** 차단 사유 (ok=false 일 때만) */
  reason?: 'INSUFFICIENT_TOKENS';
  remaining?: number | null;  // null = 무제한
  tier?: SubscriptionTier;
}

/**
 * AI 호출 직전 토큰 잔량을 검증하고, 유한 잔량이면 estTokens 만큼 차감한다.
 * 비용 방어 밸브 — 잔량 부족 시 ok:false 를 돌려주면 라우트가 402(UPGRADE_REQUIRED)로 응답한다.
 */
export async function checkAndConsumeToken(
  supabase: SupabaseClient,
  userId: string,
  estTokens = 1,
): Promise<TokenGuardResult> {
  const { data, error } = await supabase
    .from('profiles')
    .select('subscription_status, monthly_tokens_left')
    .eq('id', userId)
    .single();

  // 조회 실패(컬럼 미적용 등) → fail-open: 현재 UX 를 막지 않는다.
  if (error || !data) return { ok: true, remaining: null };

  const tier = normalizeTier(data.subscription_status as string | null);
  const left = (data as { monthly_tokens_left: number | null }).monthly_tokens_left;

  // NULL = 무제한(미설정) → 통과 (차감 없음)
  if (left === null || left === undefined) return { ok: true, remaining: null, tier };

  if (left < estTokens) {
    return { ok: false, reason: 'INSUFFICIENT_TOKENS', remaining: left, tier };
  }

  // 유한 잔량 차감 (본인 프로필 RLS) — 차감 실패는 비치명적으로 통과시킨다.
  const next = left - estTokens;
  await supabase.from('profiles').update({ monthly_tokens_left: next }).eq('id', userId);
  return { ok: true, remaining: next, tier };
}
