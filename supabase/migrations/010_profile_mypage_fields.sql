-- ============================================================
-- 010. 마이페이지 — profiles 확장 (연락처 / 구독 등급 / 관심 종목)
--   - phone               : 연락처 (선택)
--   - subscription_status : 결제 구독 등급 (FREE_TRIAL | PREMIUM) — 결제 퍼널 스캐폴딩
--   - interest_categories : 관심 시험 종목 (learning_categories.id[] )
--   ⚠️ 멱등(재실행 안전): ADD COLUMN IF NOT EXISTS / 제약 DROP→ADD
--   ⚠️ Supabase 운영 DB 직접 실행 (node scripts/migrate.js 010_profile_mypage_fields.sql)
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone               TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT  NOT NULL DEFAULT 'FREE_TRIAL';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interest_categories UUID[] NOT NULL DEFAULT '{}';

-- 구독 등급 값 가드 (멱등)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;
ALTER TABLE profiles ADD  CONSTRAINT profiles_subscription_status_check
  CHECK (subscription_status IN ('FREE_TRIAL', 'PREMIUM'));

-- 본인 프로필 읽기/수정 RLS(own_profile_rw)는 001에서 이미 보장됨 (auth.uid() = id).
