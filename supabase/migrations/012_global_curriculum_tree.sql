-- ============================================================
-- 012. 글로벌 교과 4단계 트리 (additive) — learning_chapters 확장 + curriculum_code 백필
--
--   [4단계 트리]  country → grade_level → stream → course
--     - country     국가          : KR | CA | UK
--     - grade_level 학년/과정      : (KR) 중등/고등 · (CA) Grade 9-12 · (UK) GCSE/A-Level
--     - stream      시험 목적/스트림: 내신 / 수능 / IB / AP / OSSD / A-Level ...
--     - course      세부 선택 과목  : 수학 / 영어 / Further Maths / English Literature ...
--
--   ⚠️ 데이터 보존: 기존 행 삭제 없음. 신규 컬럼 추가 후 curriculum_code 기준 백필.
--   ⚠️ 멱등(재실행 안전): ADD COLUMN IF NOT EXISTS / UPDATE는 country IS NULL 가드.
--   ⚠️ Supabase 운영 DB 직접 실행 (node scripts/migrate.js 012_global_curriculum_tree.sql)
-- ============================================================

ALTER TABLE learning_chapters ADD COLUMN IF NOT EXISTS country     TEXT;
ALTER TABLE learning_chapters ADD COLUMN IF NOT EXISTS grade_level TEXT;
ALTER TABLE learning_chapters ADD COLUMN IF NOT EXISTS stream      TEXT;
ALTER TABLE learning_chapters ADD COLUMN IF NOT EXISTS course      TEXT;

-- ── 기존 글로벌 커리큘럼 백필 (curriculum_code 기준, 멱등) ──
UPDATE learning_chapters
  SET country = 'KR', grade_level = '고등', stream = '내신/수능', course = '수학'
  WHERE curriculum_code = 'KR_HIGH_MATH' AND country IS NULL;

UPDATE learning_chapters
  SET country = 'UK', grade_level = 'A-Level', stream = 'A-Level', course = 'Mathematics'
  WHERE curriculum_code = 'UK_ALEVEL_MATH' AND country IS NULL;

UPDATE learning_chapters
  SET country = 'CA', grade_level = 'Grade 11-12', stream = 'OSSD', course = 'Mathematics'
  WHERE curriculum_code = 'CA_ON_MATH' AND country IS NULL;

-- 트리 필터 조회 가속
CREATE INDEX IF NOT EXISTS idx_chapters_curriculum_tree
  ON learning_chapters (country, grade_level, stream, course);
