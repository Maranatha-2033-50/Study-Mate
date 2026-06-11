-- ============================================================
-- 003. Subjective (Writing/Speaking) AI Rubric Feedback
--   - user_attempts 에 jsonb 첨삭 결과 저장 컬럼 추가
--   - 주관식 답안은 사전 시드된 객관식 question 이 없을 수 있으므로
--     question_id / is_correct 제약을 완화
--   - SUBJECTIVE 세션 타입 허용
--   ⚠️ 수동 마이그레이션: Supabase SQL Editor 에서 1회 실행
-- ============================================================

-- 1. 주관식 채점 결과(JSON) 저장 컬럼
--    overall_score / criteria / corrections / general_feedback / tutor_guide 전체를 보관
ALTER TABLE user_attempts
  ADD COLUMN IF NOT EXISTS feedback JSONB;

-- 2. 주관식 답안은 객관식 문항 FK·정오답이 없을 수 있음 → NOT NULL 완화
ALTER TABLE user_attempts ALTER COLUMN question_id DROP NOT NULL;
ALTER TABLE user_attempts ALTER COLUMN is_correct  DROP NOT NULL;

-- 3. SUBJECTIVE 세션 타입 허용 (기존 CHECK 제약 교체)
ALTER TABLE study_sessions DROP CONSTRAINT IF EXISTS study_sessions_session_type_check;
ALTER TABLE study_sessions
  ADD CONSTRAINT study_sessions_session_type_check
  CHECK (session_type IN ('DIAGNOSTIC', 'INFINITE_TRAINING', 'SUBJECTIVE'));

-- 4. feedback 가 있는 행만 빠르게 조회하기 위한 부분 인덱스 (강사 코칭 백서 조회용)
CREATE INDEX IF NOT EXISTS idx_attempts_feedback
  ON user_attempts(session_id)
  WHERE feedback IS NOT NULL;

-- 기존 RLS 정책(own_attempts / tutor_reads_student_attempts)이
-- 새 컬럼에도 그대로 적용되므로 추가 정책은 불필요.
