-- ============================================================
-- 016. 3개 등급 과금 가드 재편 + 비용 방어용 토큰(크레딧) 인프라 — Phase 13
--
--   [구독 등급 재편] subscription_status: FREE_TRIAL|PREMIUM → BASIC|PLUS|PREMIUM
--     - 기존 FREE_TRIAL 행을 BASIC 으로 치환(taster 무료 등급)하고 기본값도 BASIC 으로 전환.
--     - PREMIUM 은 그대로 유지. PLUS 는 신규 유료 등급.
--   [비용 방어 토큰] monthly_tokens_left (INTEGER, NULL 허용):
--     - 월간 LLM 호출 크레딧 잔량. NULL = 무제한(미설정) → 토큰 가드는 fail-open.
--     - 결제 퍼널/배치 충전 개통 시 등급별 한도로 채워 차감 밸브를 활성화한다.
--       (한도 상수는 src/lib/token-guard.ts 의 TIER_TOKEN_QUOTA 와 동기화)
--
--   ⚠️ 멱등(재실행 안전): ADD COLUMN IF NOT EXISTS / 제약 DROP→ADD / 데이터 UPDATE 가드
--   ⚠️ Supabase 운영 DB 직접 실행 (node scripts/migrate.js 016_subscription_tiers_and_tokens.sql)
-- ============================================================

-- 1) 기존 CHECK 제약 해제 → 레거시 값 치환 → 신규 3등급 제약 재적용 (순서 중요)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;

UPDATE profiles SET subscription_status = 'BASIC' WHERE subscription_status = 'FREE_TRIAL';

ALTER TABLE profiles ALTER COLUMN subscription_status SET DEFAULT 'BASIC';

ALTER TABLE profiles ADD CONSTRAINT profiles_subscription_status_check
  CHECK (subscription_status IN ('BASIC', 'PLUS', 'PREMIUM'));

-- 2) 비용 방어용 월간 토큰 크레딧 잔량 (NULL = 무제한 / 미설정)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS monthly_tokens_left INTEGER;

-- 본인 프로필 읽기/수정 RLS(own_profile_rw)는 001에서 이미 보장됨 (auth.uid() = id).
