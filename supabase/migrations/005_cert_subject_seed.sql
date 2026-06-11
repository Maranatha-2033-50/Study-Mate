-- ============================================================
-- 005. 자격증(정보처리기사) 보강 + 교과 과외(SCHOOL) 시드 + 전체평균 뷰
--   - 정보처리기사 객관식 3문항 추가 (한글 해설 포함)
--   - 고등 수학 객관식 2 + 고등 영어 독해 1 시드 (SCHOOL)
--   - category_skill_averages 뷰: 상대위치 지표용 전체 유저 평균 정답률
--   ⚠️ 수동 마이그레이션: Supabase SQL Editor 에서 1회 실행
--   ※ 모든 문항은 시험 포맷에 충실한 오리지널 콘텐츠
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- A. 전체 유저 평균 정답률 뷰 (level_1 영역별)
--    일반 뷰는 소유자 권한으로 실행되어 집계만 노출 — 개별 데이터 비노출
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW category_skill_averages AS
SELECT
  ss.category_id,
  lc.level_1,
  ROUND(
    100.0 * SUM(CASE WHEN ua.is_correct THEN 1 ELSE 0 END)
          / NULLIF(COUNT(ua.id) FILTER (WHERE ua.is_correct IS NOT NULL), 0), 1
  ) AS avg_accuracy,
  COUNT(DISTINCT ss.user_id) AS user_count
FROM user_attempts ua
JOIN study_sessions      ss ON ss.id = ua.session_id
JOIN universal_questions uq ON uq.id = ua.question_id
JOIN learning_chapters   lc ON lc.id = uq.chapter_id
WHERE ua.is_correct IS NOT NULL
GROUP BY ss.category_id, lc.level_1;

GRANT SELECT ON category_skill_averages TO anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- B. 정보처리기사 객관식 3문항 보강
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  cat_it UUID;
  ch_sql UUID;
  ch_dp  UUID;
BEGIN
  SELECT id INTO cat_it FROM learning_categories
    WHERE type = 'CERT' AND title = '정보처리기사' LIMIT 1;
  IF cat_it IS NULL THEN
    cat_it := uuid_generate_v4();
    INSERT INTO learning_categories (id, type, title) VALUES (cat_it, 'CERT', '정보처리기사');
  END IF;

  -- 멱등 가드
  IF EXISTS (
    SELECT 1 FROM universal_questions q
    JOIN learning_chapters c ON c.id = q.chapter_id
    WHERE c.category_id = cat_it AND q.question_text LIKE '%객체가 오직 하나만 생성%'
  ) THEN
    RAISE NOTICE '정보처리기사 보강 문항 이미 존재 — skip.';
  ELSE
    SELECT id INTO ch_sql FROM learning_chapters
      WHERE category_id = cat_it AND level_2 = 'SQL 활용' LIMIT 1;
    IF ch_sql IS NULL THEN
      ch_sql := uuid_generate_v4();
      INSERT INTO learning_chapters (id, category_id, level_1, level_2)
        VALUES (ch_sql, cat_it, '데이터베이스', 'SQL 활용');
    END IF;

    SELECT id INTO ch_dp FROM learning_chapters
      WHERE category_id = cat_it AND level_2 = '디자인 패턴' LIMIT 1;
    IF ch_dp IS NULL THEN
      ch_dp := uuid_generate_v4();
      INSERT INTO learning_chapters (id, category_id, level_1, level_2)
        VALUES (ch_dp, cat_it, '소프트웨어 공학', '디자인 패턴');
    END IF;

    INSERT INTO universal_questions
      (chapter_id, question_type, question_text, options, answer, difficulty, explanation)
    VALUES
      (ch_dp, 'MULTIPLE_4',
       '다음 설명에 해당하는 디자인 패턴은?\n\n「객체가 오직 하나만 생성되도록 보장하고, 어디서든 그 인스턴스에 전역적으로 접근할 수 있게 하는 생성(Creational) 패턴」',
       '{"A":"싱글톤(Singleton)","B":"팩토리 메서드(Factory Method)","C":"옵서버(Observer)","D":"전략(Strategy)"}',
       'A', '중',
       '하나의 인스턴스만 보장하고 전역 접근점을 제공하는 것은 싱글톤 패턴의 핵심 정의입니다. 팩토리 메서드는 객체 생성을 서브클래스에 위임, 옵서버는 상태 변화 통지, 전략은 알고리즘 교체에 쓰입니다.'),

      (ch_dp, 'MULTIPLE_5',
       '모듈의 독립성을 높이기 위한 바람직한 설계 방향으로 옳은 것은?',
       '{"A":"결합도(Coupling)는 높이고 응집도(Cohesion)는 낮춘다","B":"결합도와 응집도를 모두 높인다","C":"결합도는 낮추고 응집도는 높인다","D":"결합도와 응집도를 모두 낮춘다","E":"결합도와 응집도는 설계와 무관하다"}',
       'C', '중',
       '좋은 모듈 설계의 원칙은 ''낮은 결합도(Low Coupling), 높은 응집도(High Cohesion)''입니다. 모듈 간 의존성(결합도)은 줄이고, 모듈 내부 요소들의 관련성(응집도)은 높여야 독립성과 유지보수성이 좋아집니다.'),

      (ch_sql, 'MULTIPLE_4',
       '다음 SQL에서 그룹별로 묶은 결과에 조건을 적용하려고 한다. 빈칸에 들어갈 키워드는?\n\nSELECT 부서, AVG(급여) FROM 사원 GROUP BY 부서 ______ AVG(급여) >= 5000000;',
       '{"A":"WHERE","B":"HAVING","C":"ORDER BY","D":"DISTINCT"}',
       'B', '중',
       'GROUP BY로 묶은 그룹에 조건을 거는 절은 HAVING입니다. WHERE는 그룹화 이전 개별 행에 조건을 적용하므로 집계함수(AVG 등)를 조건으로 쓸 수 없습니다. 집계 결과에 대한 필터링은 반드시 HAVING을 사용합니다.');

    RAISE NOTICE '정보처리기사 객관식 3문항 추가 완료.';
  END IF;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- C. 교과 과외(SCHOOL) — 고등 수학 2 + 고등 영어 1
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  cat_math UUID;
  cat_eng  UUID;
  ch_calc  UUID;
  ch_read  UUID;
BEGIN
  -- 고등 수학 카테고리
  SELECT id INTO cat_math FROM learning_categories
    WHERE type = 'SCHOOL' AND title = '고등 수학' LIMIT 1;
  IF cat_math IS NULL THEN
    cat_math := uuid_generate_v4();
    INSERT INTO learning_categories (id, type, title) VALUES (cat_math, 'SCHOOL', '고등 수학');
  END IF;

  -- 고등 영어 카테고리
  SELECT id INTO cat_eng FROM learning_categories
    WHERE type = 'SCHOOL' AND title = '고등 영어' LIMIT 1;
  IF cat_eng IS NULL THEN
    cat_eng := uuid_generate_v4();
    INSERT INTO learning_categories (id, type, title) VALUES (cat_eng, 'SCHOOL', '고등 영어');
  END IF;

  -- 멱등 가드
  IF EXISTS (
    SELECT 1 FROM learning_chapters
    WHERE category_id = cat_math AND level_2 = '함수와 미분'
  ) THEN
    RAISE NOTICE '교과(SCHOOL) 시드 이미 존재 — skip.';
    RETURN;
  END IF;

  ch_calc := uuid_generate_v4();
  ch_read := uuid_generate_v4();
  INSERT INTO learning_chapters (id, category_id, level_1, level_2) VALUES
    (ch_calc, cat_math, '미적분', '함수와 미분'),
    (ch_read, cat_eng,  '독해',   '주제·요지 추론');

  -- 고등 수학 (미분/함수)
  INSERT INTO universal_questions
    (chapter_id, question_type, question_text, options, answer, difficulty, explanation)
  VALUES
    (ch_calc, 'MULTIPLE_4',
     '함수 f(x) = x³ - 3x 의 도함수 f''(x) 로 옳은 것은?',
     '{"A":"3x² - 3","B":"3x² - 3x","C":"x² - 3","D":"3x - 3"}',
     'A', '중',
     '다항함수의 미분은 각 항에 대해 (지수)·x^(지수-1) 로 계산합니다. x³ → 3x², -3x → -3 이므로 f''(x) = 3x² - 3 입니다.'),

    (ch_calc, 'MULTIPLE_4',
     '이차함수 f(x) = x² - 4x + 3 의 최솟값은?',
     '{"A":"-1","B":"0","C":"1","D":"3"}',
     'A', '중',
     'f(x) = x² - 4x + 3 = (x-2)² - 1 로 완전제곱식 변형하면, x = 2 에서 최솟값 -1 을 가집니다. (아래로 볼록한 포물선이므로 꼭짓점의 y값이 최솟값)');

  -- 고등 영어 (독해)
  INSERT INTO universal_questions
    (chapter_id, question_type, question_text, options, answer, difficulty, explanation)
  VALUES
    (ch_read, 'MULTIPLE_4',
     'Read the passage and answer the question.\n\n「Sleep is not merely a period of rest. During deep sleep, the brain actively consolidates memories, clearing away unnecessary information while strengthening important neural connections. Students who sleep well after studying tend to remember more than those who stay up all night.」\n\n**What is the main idea of the passage?**',
     '{"A":"Students should study late into the night.","B":"Sleep plays an active role in strengthening memory.","C":"The brain stops working during sleep.","D":"Resting is a waste of study time."}',
     'B', '중',
     '지문은 수면이 단순한 휴식이 아니라 기억을 ''능동적으로 강화·정리''한다고 설명합니다. 따라서 요지는 B(수면이 기억 강화에 능동적 역할을 한다). A·D는 지문과 반대, C는 ''actively consolidates''와 모순됩니다.');

  RAISE NOTICE '교과(SCHOOL) 시드 완료: 고등 수학 2 + 고등 영어 1.';
END;
$$;
