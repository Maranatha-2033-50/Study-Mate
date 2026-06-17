-- ============================================================
-- 013. Realtime 활성화 — Q&A 쪽지방 실시간 동기화
--   tutor_messages / tutor_questions 를 supabase_realtime 퍼블리케이션에 추가하여
--   클라이언트 postgres_changes 구독(INSERT/UPDATE)이 동작하도록 한다.
--   (Realtime 전달도 RLS를 따르므로 당사자만 변경을 수신)
--   ⚠️ 멱등: 이미 추가돼 있으면 건너뜀. ⚠️ Supabase 운영 DB 직접 실행.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tutor_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tutor_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tutor_questions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tutor_questions;
  END IF;
END $$;
