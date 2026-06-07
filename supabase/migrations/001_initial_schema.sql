-- ============================================================
-- AI Learning Platform — Initial Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- 1. profiles
-- ────────────────────────────────────────────────────────────
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('student', 'tutor')),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 2. tutor_students
-- ────────────────────────────────────────────────────────────
CREATE TABLE tutor_students (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tutor_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tutor_id, student_id)
);

-- ────────────────────────────────────────────────────────────
-- 3. learning_categories
-- ────────────────────────────────────────────────────────────
CREATE TABLE learning_categories (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type       TEXT NOT NULL CHECK (type IN ('CERT', 'LANG', 'SCHOOL')),
  title      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 4. learning_chapters
-- ────────────────────────────────────────────────────────────
CREATE TABLE learning_chapters (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES learning_categories(id) ON DELETE CASCADE,
  level_1     TEXT NOT NULL,  -- 대분류/영역 (예: Reading, 데이터베이스)
  level_2     TEXT NOT NULL   -- 중분류/유형 (예: Matching Headings, 관계대수)
);

-- ────────────────────────────────────────────────────────────
-- 5. universal_questions
-- ────────────────────────────────────────────────────────────
CREATE TABLE universal_questions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id    UUID NOT NULL REFERENCES learning_chapters(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL CHECK (question_type IN ('MULTIPLE_4', 'MULTIPLE_5', 'SHORT_ANSWER')),
  question_text TEXT NOT NULL,           -- Markdown 지원
  options       JSONB,                   -- {"A":"...", "B":"...", ...} | null for SHORT_ANSWER
  answer        TEXT NOT NULL,           -- 'A' | '정답텍스트'
  difficulty    TEXT NOT NULL CHECK (difficulty IN ('상', '중', '하')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 6. study_sessions
-- ────────────────────────────────────────────────────────────
CREATE TABLE study_sessions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id  UUID NOT NULL REFERENCES learning_categories(id),
  session_type TEXT NOT NULL CHECK (session_type IN ('DIAGNOSTIC', 'INFINITE_TRAINING')),
  -- config examples:
  --   DIAGNOSTIC:        {"limit_type": "COUNT", "limit_value": 20}
  --   INFINITE_TRAINING: {"limit_type": "COUNT"|"TIME", "limit_value": 10|15, "chapter_ids": [...]}
  config       JSONB NOT NULL DEFAULT '{}',
  status       TEXT NOT NULL CHECK (status IN ('IN_PROGRESS', 'COMPLETED')) DEFAULT 'IN_PROGRESS',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 7. user_attempts
-- ────────────────────────────────────────────────────────────
CREATE TABLE user_attempts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id   UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  question_id  UUID NOT NULL REFERENCES universal_questions(id),
  user_answer  TEXT NOT NULL,
  is_correct   BOOLEAN NOT NULL,
  elapsed_time INTEGER NOT NULL DEFAULT 0,  -- 해당 문제 순수 활성 시간 (초)
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- Indexes
-- ────────────────────────────────────────────────────────────
CREATE INDEX idx_tutor_students_tutor    ON tutor_students(tutor_id);
CREATE INDEX idx_tutor_students_student  ON tutor_students(student_id);
CREATE INDEX idx_chapters_category       ON learning_chapters(category_id);
CREATE INDEX idx_questions_chapter       ON universal_questions(chapter_id);
CREATE INDEX idx_sessions_user           ON study_sessions(user_id);
CREATE INDEX idx_sessions_category       ON study_sessions(category_id);
CREATE INDEX idx_attempts_session        ON user_attempts(session_id);
CREATE INDEX idx_attempts_question       ON user_attempts(question_id);

-- ────────────────────────────────────────────────────────────
-- Row Level Security
-- ────────────────────────────────────────────────────────────
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_students     ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_chapters  ENABLE ROW LEVEL SECURITY;
ALTER TABLE universal_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_attempts      ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "own_profile_rw" ON profiles
  USING (auth.uid() = id);
CREATE POLICY "tutor_reads_student_profile" ON profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tutor_students
    WHERE tutor_id = auth.uid() AND student_id = profiles.id
  ));

-- tutor_students
CREATE POLICY "tutor_manages_mappings" ON tutor_students
  USING (tutor_id = auth.uid() OR student_id = auth.uid());

-- reference tables: all authenticated users can read
CREATE POLICY "auth_read_categories" ON learning_categories  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_chapters"   ON learning_chapters    FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_questions"  ON universal_questions  FOR SELECT TO authenticated USING (true);

-- study_sessions
CREATE POLICY "own_sessions" ON study_sessions
  USING (user_id = auth.uid());
CREATE POLICY "tutor_reads_student_sessions" ON study_sessions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tutor_students
    WHERE tutor_id = auth.uid() AND student_id = study_sessions.user_id
  ));

-- user_attempts
CREATE POLICY "own_attempts" ON user_attempts
  USING (EXISTS (
    SELECT 1 FROM study_sessions
    WHERE id = user_attempts.session_id AND user_id = auth.uid()
  ));
CREATE POLICY "tutor_reads_student_attempts" ON user_attempts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM study_sessions ss
    JOIN tutor_students ts ON ts.student_id = ss.user_id
    WHERE ss.id = user_attempts.session_id AND ts.tutor_id = auth.uid()
  ));

-- ────────────────────────────────────────────────────────────
-- Auto-create profile on signup
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, role, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ────────────────────────────────────────────────────────────
-- weakness_stats view — 취약 단원 집계 (강사/AI 플래너 공용)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW weakness_stats AS
SELECT
  ss.user_id,
  ss.category_id,
  lc.id          AS chapter_id,
  lc.level_1,
  lc.level_2,
  COUNT(ua.id)   AS total_attempts,
  SUM(CASE WHEN ua.is_correct THEN 1 ELSE 0 END) AS correct_count,
  ROUND(
    100.0 * SUM(CASE WHEN ua.is_correct THEN 1 ELSE 0 END)
          / NULLIF(COUNT(ua.id), 0), 1
  )              AS accuracy_rate,
  ROUND(AVG(ua.elapsed_time)::NUMERIC, 0) AS avg_elapsed_seconds
FROM user_attempts ua
JOIN study_sessions     ss ON ss.id = ua.session_id
JOIN universal_questions uq ON uq.id = ua.question_id
JOIN learning_chapters   lc ON lc.id = uq.chapter_id
GROUP BY ss.user_id, ss.category_id, lc.id, lc.level_1, lc.level_2;

-- ────────────────────────────────────────────────────────────
-- Seed: sample categories, chapters, questions (dev only)
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  cat_ielts   UUID := uuid_generate_v4();
  cat_cert    UUID := uuid_generate_v4();
  ch1 UUID; ch2 UUID; ch3 UUID;
BEGIN
  INSERT INTO learning_categories (id, type, title) VALUES
    (cat_ielts, 'LANG', 'IELTS'),
    (cat_cert,  'CERT', '정보처리기사');

  -- IELTS chapters
  INSERT INTO learning_chapters (id, category_id, level_1, level_2) VALUES
    (uuid_generate_v4(), cat_ielts, 'Reading', 'Matching Headings'),
    (uuid_generate_v4(), cat_ielts, 'Reading', 'True/False/Not Given'),
    (uuid_generate_v4(), cat_ielts, 'Listening', 'Form Completion');

  -- 정보처리기사 chapters
  INSERT INTO learning_chapters (id, category_id, level_1, level_2) VALUES
    (uuid_generate_v4(), cat_cert, '데이터베이스', '관계대수'),
    (uuid_generate_v4(), cat_cert, '데이터베이스', 'SQL 활용'),
    (uuid_generate_v4(), cat_cert, '소프트웨어 공학', '디자인 패턴');

  -- Sample questions for first IELTS chapter
  SELECT id INTO ch1 FROM learning_chapters
    WHERE category_id = cat_ielts AND level_2 = 'Matching Headings' LIMIT 1;

  INSERT INTO universal_questions (chapter_id, question_type, question_text, options, answer, difficulty) VALUES
    (ch1, 'MULTIPLE_4',
      '## Passage\nThe global rise of remote work has fundamentally altered urban planning priorities...\n\n**Which heading best matches paragraph A?**',
      '{"A":"The decline of city centres","B":"New commuting patterns","C":"Remote work and urban transformation","D":"Housing market pressures"}',
      'C', '중'),
    (ch1, 'MULTIPLE_4',
      'Paragraph B focuses primarily on which aspect of remote work infrastructure?',
      '{"A":"Internet bandwidth requirements","B":"Home office ergonomics","C":"Corporate real estate downsizing","D":"Digital security protocols"}',
      'A', '하');

  -- Sample question for 정보처리기사
  SELECT id INTO ch2 FROM learning_chapters
    WHERE category_id = cat_cert AND level_2 = '관계대수' LIMIT 1;

  INSERT INTO universal_questions (chapter_id, question_type, question_text, options, answer, difficulty) VALUES
    (ch2, 'MULTIPLE_5',
      '관계 대수에서 두 릴레이션 R과 S의 **자연 조인(Natural Join)**에 대한 설명으로 옳은 것은?',
      '{"A":"카티션 프로덕트 후 선택 연산을 수행한다","B":"공통 속성이 없어도 수행 가능하다","C":"결과 릴레이션에 공통 속성은 한 번만 나타난다","D":"항상 교환 법칙이 성립하지 않는다","E":"세타 조인의 특수한 경우이다"}',
      'C', '중'),
    (ch2, 'SHORT_ANSWER',
      '릴레이션 R(A, B, C)에서 속성 A를 기준으로 중복을 제거하고 그룹별 B의 평균값을 구하는 SQL 집계 함수를 작성하시오.',
      NULL,
      'AVG(B)', '상');
END;
$$;
