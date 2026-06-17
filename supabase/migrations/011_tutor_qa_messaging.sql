-- ============================================================
-- 011. 1:1 튜터 Q&A 메시징 (오답노트 연동) — 프리미엄 핵심 파이프라인 골조
--
--   [관계 설계]
--   tutor_questions  : 학생이 특정 오답에 대해 연 "질문 스레드"의 머리(컨텍스트 묶음)
--     - student_id     학생(작성자)            → profiles
--     - tutor_id       담당 튜터(배정 전 NULL)  → profiles
--     - question_id    원 문항(삭제 대비 NULL)  → universal_questions
--     - wrong_context  풀었던 문제+선지+정답+본인 오답 스냅샷 (JSONB)
--     - ai_analysis    AI 해설 리포트 스냅샷 (텍스트)
--     - status         OPEN | ANSWERED | CLOSED
--   tutor_messages   : 위 스레드에 달리는 메시지(학생 질문 ↔ 튜터 답변) 1:N
--     - question_id    → tutor_questions(id)
--     - sender_id      작성자 → profiles
--     - sender_role    student | tutor
--     - body           메시지 본문(첫 학생 메시지 = student_message)
--
--   ⚠️ 멱등(재실행 안전): IF NOT EXISTS / 정책 DROP→CREATE
--   ⚠️ Supabase 운영 DB 직접 실행 (node scripts/migrate.js 011_tutor_qa_messaging.sql)
-- ============================================================

CREATE TABLE IF NOT EXISTS tutor_questions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id    UUID NOT NULL REFERENCES profiles(id)            ON DELETE CASCADE,
  tutor_id      UUID          REFERENCES profiles(id)            ON DELETE SET NULL,
  question_id   UUID          REFERENCES universal_questions(id) ON DELETE SET NULL,
  wrong_context JSONB NOT NULL DEFAULT '{}',
  ai_analysis   TEXT,
  status        TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ANSWERED', 'CLOSED')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tutor_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID NOT NULL REFERENCES tutor_questions(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES profiles(id)        ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('student', 'tutor')),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tutor_questions_student ON tutor_questions(student_id);
CREATE INDEX IF NOT EXISTS idx_tutor_questions_tutor   ON tutor_questions(tutor_id);
CREATE INDEX IF NOT EXISTS idx_tutor_messages_question ON tutor_messages(question_id);

-- ── RLS ──
ALTER TABLE tutor_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_messages  ENABLE ROW LEVEL SECURITY;

-- 학생: 본인 질문 전 권한 (생성/조회/수정)
DROP POLICY IF EXISTS "tq_student_rw" ON tutor_questions;
CREATE POLICY "tq_student_rw" ON tutor_questions
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- 튜터: 본인에게 배정됐거나 매핑된 학생의 질문 조회
DROP POLICY IF EXISTS "tq_tutor_read" ON tutor_questions;
CREATE POLICY "tq_tutor_read" ON tutor_questions FOR SELECT
  USING (
    tutor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM tutor_students ts
               WHERE ts.tutor_id = auth.uid() AND ts.student_id = tutor_questions.student_id)
  );

-- 튜터: 배정된 질문 상태/답변 처리(업데이트)
DROP POLICY IF EXISTS "tq_tutor_update" ON tutor_questions;
CREATE POLICY "tq_tutor_update" ON tutor_questions FOR UPDATE
  USING (tutor_id = auth.uid())
  WITH CHECK (tutor_id = auth.uid());

-- 메시지: 스레드 참여자(학생/배정 튜터)만 조회·작성
DROP POLICY IF EXISTS "tm_participant_rw" ON tutor_messages;
CREATE POLICY "tm_participant_rw" ON tutor_messages
  USING (EXISTS (SELECT 1 FROM tutor_questions q
                 WHERE q.id = tutor_messages.question_id
                   AND (q.student_id = auth.uid() OR q.tutor_id = auth.uid())))
  WITH CHECK (sender_id = auth.uid()
              AND EXISTS (SELECT 1 FROM tutor_questions q
                          WHERE q.id = tutor_messages.question_id
                            AND (q.student_id = auth.uid() OR q.tutor_id = auth.uid())));
