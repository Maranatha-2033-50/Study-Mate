-- ============================================================
-- 009. 교과(SCHOOL) 글로벌 — 캐나다 온타리오 고교 수학 (CA_ON_MATH)
--   - 008과 동일한 SCHOOL 카테고리 '교과 과외 (수학)'를 공유하고,
--     curriculum_code='CA_ON_MATH' 트랙을 추가한다.
--   - 단원: Grade 11 Functions(함수 기초/지수함수),
--           Grade 12 Advanced Functions & Calculus(다항함수/미적분과 벡터)
--   - 문항: 지수함수 성장/쇠퇴 + 변화율(Rate of Change), 영문 본문 + 한국어 상세 해설 필수
--   ⚠️ 멱등: curriculum_code='CA_ON_MATH' 로만 스코프 정리 → KR/UK 트랙 무영향
--   ⚠️ Supabase 자동(migrate.js) 실행
-- ============================================================

DO $$
DECLARE
  cat_math UUID;
  ch_g11_basic UUID; ch_g11_exp UUID;     -- Grade 11
  ch_g12_poly  UUID; ch_g12_calc UUID;    -- Grade 12
BEGIN
  -- 008에서 만든 카테고리 재사용 (없으면 생성)
  SELECT id INTO cat_math FROM learning_categories
    WHERE type = 'SCHOOL' AND title = '교과 과외 (수학)' LIMIT 1;
  IF cat_math IS NULL THEN
    cat_math := uuid_generate_v4();
    INSERT INTO learning_categories (id, type, title) VALUES (cat_math, 'SCHOOL', '교과 과외 (수학)');
  END IF;

  -- 멱등 정리: CA_ON_MATH 트랙만 (KR/UK 보존)
  DELETE FROM user_attempts WHERE question_id IN (
    SELECT q.id FROM universal_questions q
    JOIN learning_chapters c ON c.id = q.chapter_id
    WHERE c.category_id = cat_math AND c.curriculum_code = 'CA_ON_MATH');
  DELETE FROM universal_questions WHERE chapter_id IN (
    SELECT id FROM learning_chapters
    WHERE category_id = cat_math AND curriculum_code = 'CA_ON_MATH');
  DELETE FROM learning_chapters
    WHERE category_id = cat_math AND curriculum_code = 'CA_ON_MATH';

  -- ── CA 온타리오 단원 트리 (curriculum_code = 'CA_ON_MATH') ──
  ch_g11_basic := uuid_generate_v4(); ch_g11_exp := uuid_generate_v4();
  ch_g12_poly  := uuid_generate_v4(); ch_g12_calc := uuid_generate_v4();
  INSERT INTO learning_chapters (id, category_id, level_1, level_2, curriculum_code) VALUES
    (ch_g11_basic, cat_math, 'Grade 11 Functions',                    '함수 기초',      'CA_ON_MATH'),
    (ch_g11_exp,   cat_math, 'Grade 11 Functions',                    '지수함수',       'CA_ON_MATH'),
    (ch_g12_poly,  cat_math, 'Grade 12 Advanced Functions & Calculus','다항함수',       'CA_ON_MATH'),
    (ch_g12_calc,  cat_math, 'Grade 12 Advanced Functions & Calculus','미적분과 벡터',  'CA_ON_MATH');

  -- ════ 지수함수 — Exponential Growth / Decay ════
  INSERT INTO universal_questions
    (chapter_id, question_type, question_text, options, answer, difficulty, explanation)
  VALUES
    (ch_g11_exp, 'MULTIPLE_4',
     'A population of bacteria doubles every hour. If the initial population is 500, what is the population after 3 hours?',
     '{"A":"1,500","B":"3,000","C":"4,000","D":"8,000"}',
     'C', '하',
     '매시간 2배로 증가하는 지수적 성장입니다. P = 500 × 2^t (t는 시간). t=3 → 500 × 2³ = 500 × 8 = 4,000. (1500은 500×3 처럼 선형 증가로 착각한 오답입니다.)'),

    (ch_g11_exp, 'MULTIPLE_4',
     'A radioactive substance decays according to A = A₀(0.5)^(t/5), where t is in years. If A₀ = 80 g, how much remains after 10 years?',
     '{"A":"40 g","B":"20 g","C":"16 g","D":"8 g"}',
     'B', '중',
     '지수 0.5의 밑과 t/5 지수로 보아 반감기(half-life)가 5년입니다. 10년은 반감기 2번(10/5=2)에 해당하므로 A = 80 × (0.5)² = 80 × 0.25 = 20 g.'),

    (ch_g11_exp, 'MULTIPLE_4',
     'The value of an investment is modelled by V = 1000(1.08)^t dollars after t years. Which statement is correct?',
     '{"A":"It increases by $8 each year.","B":"It increases by 8% each year.","C":"It decreases by 8% each year.","D":"It doubles every year."}',
     'B', '중',
     '밑 1.08 = 1 + 0.08 이므로 매년 직전 금액의 8%만큼 복리로 증가합니다(정답 B). $8 정액 증가(A)나 매년 2배(D)가 아니며, 밑이 1보다 커서 감소(C)도 아닙니다.'),

    (ch_g11_exp, 'SHORT_ANSWER',
     'A 200 mg sample halves every 3 hours. How many milligrams remain after 6 hours? (Enter the number only.)',
     NULL,
     '50', '중',
     '반감기가 3시간이므로 6시간은 반감기 2회(6/3=2)입니다. 남은 양 = 200 × (1/2)² = 200 × 1/4 = 50 mg. 따라서 정답은 50.');

  -- ════ 미적분과 벡터 — Rate of Change ════
  INSERT INTO universal_questions
    (chapter_id, question_type, question_text, options, answer, difficulty, explanation)
  VALUES
    (ch_g12_calc, 'MULTIPLE_4',
     'For f(x) = x², what is the average rate of change between x = 1 and x = 3?',
     '{"A":"2","B":"3","C":"4","D":"8"}',
     'C', '중',
     '평균변화율 = (f(3) - f(1)) / (3 - 1) = (9 - 1) / 2 = 8 / 2 = 4. 두 점 (1,1)과 (3,9)를 잇는 직선의 기울기와 같습니다.'),

    (ch_g12_calc, 'MULTIPLE_4',
     'For f(x) = x², the instantaneous rate of change at x = 2 (that is, f''(2)) is:',
     '{"A":"2","B":"4","C":"6","D":"8"}',
     'B', '중',
     '순간변화율은 도함수 값입니다. f(x)=x² 의 도함수 f''(x)=2x 이므로 f''(2) = 2 × 2 = 4. (평균변화율과 달리 한 점에서의 접선 기울기입니다.)'),

    (ch_g12_calc, 'MULTIPLE_4',
     'A ball''s height is given by h(t) = -5t² + 20t (metres, t in seconds). What is its instantaneous velocity at t = 1 s?',
     '{"A":"5 m/s","B":"10 m/s","C":"15 m/s","D":"20 m/s"}',
     'B', '상',
     '속도는 높이 함수의 도함수입니다. h(t) = -5t² + 20t → h''(t) = -10t + 20. t=1 대입 → h''(1) = -10 + 20 = 10 m/s. (양수이므로 아직 상승 중입니다.)');

  RAISE NOTICE '캐나다 온타리오 시드 완료: CA 단원 4 + 문항 7 (지수함수 4 + 변화율 3).';
END;
$$;
