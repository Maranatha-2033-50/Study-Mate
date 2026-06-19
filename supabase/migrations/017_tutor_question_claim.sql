-- ============================================================
-- 017. 미배정 질문 교사 클레임(Claim) 시스템 — Phase 13
--
--   학생 질문이 매핑 오류 등으로 담당 교사 미배정(tutor_id IS NULL)으로 적재될 때,
--   임의의 교사가 전역 대기 풀에서 해당 질문을 열람하고 직접 가져갈(claim) 수 있게
--   RLS 를 확장한다. 11/13 마이그레이션의 기존 정책은 유지하고 정책을 추가만 한다.
--
--   - tq_tutor_pool_read   : 교사(role='tutor')는 미배정(tutor_id IS NULL) 질문을 조회 가능
--   - tq_tutor_claim       : 교사는 미배정 질문을 본인 id 로 가져갈(UPDATE) 수 있음
--                            (WITH CHECK tutor_id = auth.uid() → 본인에게만 배정 가능)
--   원자적 클레임 경쟁 가드: 애플리케이션이 UPDATE ... WHERE id = ? AND tutor_id IS NULL
--   로 갱신하므로, 동시에 두 교사가 같은 질문을 가져가도 한쪽만 rowcount=1 로 성공한다.
--
--   ⚠️ 멱등(재실행 안전): 정책 DROP→CREATE
--   ⚠️ Supabase 운영 DB 직접 실행 (node scripts/migrate.js 017_tutor_question_claim.sql)
-- ============================================================

-- 교사: 미배정 질문 풀 조회 (기존 tq_tutor_read 와 OR 결합)
DROP POLICY IF EXISTS "tq_tutor_pool_read" ON tutor_questions;
CREATE POLICY "tq_tutor_pool_read" ON tutor_questions FOR SELECT
  USING (
    tutor_id IS NULL
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'tutor')
  );

-- 교사: 미배정 질문을 본인에게 클레임 (기존 tq_tutor_update 와 OR 결합)
DROP POLICY IF EXISTS "tq_tutor_claim" ON tutor_questions;
CREATE POLICY "tq_tutor_claim" ON tutor_questions FOR UPDATE
  USING (
    tutor_id IS NULL
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'tutor')
  )
  WITH CHECK (tutor_id = auth.uid());
