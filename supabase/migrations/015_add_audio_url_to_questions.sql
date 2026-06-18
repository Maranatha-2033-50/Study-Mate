-- ============================================================
-- 015. universal_questions — 리스닝 음원 바인딩 (audio_url)
--   - audio_url : IELTS/DELF 리스닝 문항의 음원(mp3) 주소.
--                 Supabase Storage 공개 URL 또는 외부 CDN 경로를 저장하고
--                 AudioPlayer 컴포넌트 src 에 바인딩한다. (객관식 문항은 NULL)
--   ⚠️ 멱등(재실행 안전): ADD COLUMN IF NOT EXISTS
--   ⚠️ Supabase 운영 DB 직접 실행 (node scripts/migrate.js 015_add_audio_url_to_questions.sql)
-- ============================================================

ALTER TABLE universal_questions ADD COLUMN IF NOT EXISTS audio_url TEXT;
