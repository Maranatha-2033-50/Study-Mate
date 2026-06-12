-- ============================================================
-- 007. AI 인터랙티브 정밀 플래너 — ai_study_plans 테이블
--   - exam_date            : 유저가 설정한 D-Day 시험일
--   - availability_matrix  : 요일별 가용 시간 {"mon":2,...,"sun":6}
--   - plan_content         : AI 생성 플랜 (JSON 문자열; 마일스톤 detail은 마크다운)
--   - completed_items      : 마일스톤 체크 상태 {"m1":true,...}
--   - (user_id, category_id) 당 1개 플랜 — 업서트/재설정 키
--   ⚠️ 멱등: CREATE TABLE/COLUMN/INDEX IF NOT EXISTS + DROP POLICY 후 재생성
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_study_plans (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id         UUID REFERENCES learning_categories(id) ON DELETE CASCADE,
  exam_date           DATE,
  availability_matrix JSONB NOT NULL DEFAULT '{}',
  plan_content        TEXT,
  completed_items     JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 기존에 테이블이 일부만 존재하는 경우 대비 — 컬럼 유연 보강
ALTER TABLE ai_study_plans ADD COLUMN IF NOT EXISTS exam_date           DATE;
ALTER TABLE ai_study_plans ADD COLUMN IF NOT EXISTS availability_matrix JSONB NOT NULL DEFAULT '{}';
ALTER TABLE ai_study_plans ADD COLUMN IF NOT EXISTS plan_content        TEXT;
ALTER TABLE ai_study_plans ADD COLUMN IF NOT EXISTS completed_items     JSONB NOT NULL DEFAULT '{}';
ALTER TABLE ai_study_plans ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ DEFAULT NOW();

-- (user, category) 당 1개 — upsert onConflict 키
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_study_plans_user_category
  ON ai_study_plans(user_id, category_id);

-- RLS: 본인 플랜만 읽고/쓰기
ALTER TABLE ai_study_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_study_plans ON ai_study_plans;
CREATE POLICY own_study_plans ON ai_study_plans
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
