-- ============================================================
-- 014. profiles — 관리자 권한 게이팅 (is_admin)
--   - is_admin : 전역 비즈니스 통계판(/tutor/analytics) 접근 권한.
--                교사(tutor) 계정이라도 false면 통계판 진입 차단.
--   ⚠️ 멱등(재실행 안전): ADD COLUMN IF NOT EXISTS
--   ⚠️ Supabase 운영 DB 직접 실행 (node scripts/migrate.js 014_add_is_admin_to_profiles.sql)
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- 본인 프로필 읽기 RLS(own_profile_rw)는 001에서 이미 보장됨 (auth.uid() = id).
