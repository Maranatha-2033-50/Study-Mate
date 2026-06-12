-- ============================================================
-- 008. 교과(SCHOOL) 글로벌 커리큘럼 — 한국 고등수학 + 영국 A-Level
--   - curriculum_code (006 도입) 활용: KR_HIGH_MATH / UK_ALEVEL_MATH 트랙 구분
--   - 단일 SCHOOL 카테고리 "교과 과외 (수학)" 안에 두 커리큘럼 단원 트리를 둠
--     → 대시보드가 curriculum_code 로 KR/UK 카탈로그 묶음을 그리드 분류 렌더
--   - 한국 교과 문항: 시장 맞춤 액센트 난이도 라벨('1등급 도전'/'2~3등급 굳히기'/'개념 다지기')
--   - 영국 A-Level: 영문 문항 + 한국어 상세 해설, 난이도는 기본(상/중/하)
--   ⚠️ 멱등: 카테고리 전체 DELETE→재삽입. ⚠️ Supabase 수동/자동(migrate.js) 실행
-- ============================================================

-- 0. difficulty CHECK 제약 해제 — 시장별 맞춤 라벨(자유 텍스트) 수용. 기존 상/중/하 100% 호환.
ALTER TABLE universal_questions DROP CONSTRAINT IF EXISTS universal_questions_difficulty_check;

DO $$
DECLARE
  cat_math UUID;
  ch_poly UUID; ch_eq UUID; ch_set UUID; ch_func UUID;       -- KR
  ch_core UUID; ch_mech UUID; ch_biz UUID;                   -- UK
BEGIN
  -- 카테고리 확보 (멱등)
  SELECT id INTO cat_math FROM learning_categories
    WHERE type = 'SCHOOL' AND title = '교과 과외 (수학)' LIMIT 1;
  IF cat_math IS NULL THEN
    cat_math := uuid_generate_v4();
    INSERT INTO learning_categories (id, type, title) VALUES (cat_math, 'SCHOOL', '교과 과외 (수학)');
  END IF;

  -- 멱등 정리: KR/UK 트랙만 (동일 카테고리를 공유하는 CA_ON_MATH(009) 등 타 트랙 보존)
  DELETE FROM user_attempts WHERE question_id IN (
    SELECT q.id FROM universal_questions q
    JOIN learning_chapters c ON c.id = q.chapter_id
    WHERE c.category_id = cat_math AND c.curriculum_code IN ('KR_HIGH_MATH', 'UK_ALEVEL_MATH'));
  DELETE FROM universal_questions WHERE chapter_id IN (
    SELECT id FROM learning_chapters
    WHERE category_id = cat_math AND curriculum_code IN ('KR_HIGH_MATH', 'UK_ALEVEL_MATH'));
  DELETE FROM learning_chapters
    WHERE category_id = cat_math AND curriculum_code IN ('KR_HIGH_MATH', 'UK_ALEVEL_MATH');

  -- ── KR 단원 트리 (curriculum_code = 'KR_HIGH_MATH') ──
  ch_poly := uuid_generate_v4(); ch_eq := uuid_generate_v4();
  ch_set  := uuid_generate_v4(); ch_func := uuid_generate_v4();
  INSERT INTO learning_chapters (id, category_id, level_1, level_2, curriculum_code) VALUES
    (ch_poly, cat_math, '1학년 1학기', '다항식',          'KR_HIGH_MATH'),
    (ch_eq,   cat_math, '1학년 1학기', '방정식과 부등식',  'KR_HIGH_MATH'),
    (ch_set,  cat_math, '1학년 2학기', '집합과 명제',      'KR_HIGH_MATH'),
    (ch_func, cat_math, '1학년 2학기', '함수',            'KR_HIGH_MATH');

  -- ── UK 단원 트리 (curriculum_code = 'UK_ALEVEL_MATH') ──
  ch_core := uuid_generate_v4(); ch_mech := uuid_generate_v4(); ch_biz := uuid_generate_v4();
  INSERT INTO learning_chapters (id, category_id, level_1, level_2, curriculum_code) VALUES
    (ch_core, cat_math, 'Pure',      'Core Pure Mathematics', 'UK_ALEVEL_MATH'),
    (ch_mech, cat_math, 'Mechanics', 'Further Mechanics',     'UK_ALEVEL_MATH'),
    (ch_biz,  cat_math, 'Applied',   'Business Mathematics',  'UK_ALEVEL_MATH');

  -- ════ KR 실전 문항 — 이차방정식 판별식 / 근과 계수의 관계 (액센트 난이도) ════
  INSERT INTO universal_questions
    (chapter_id, question_type, question_text, options, answer, difficulty, explanation)
  VALUES
    (ch_eq, 'MULTIPLE_4',
     '이차방정식 x²-5x+6=0 의 두 근의 합과 곱을 바르게 구한 것은?',
     '{"A":"합: 5, 곱: 6","B":"합: -5, 곱: 6","C":"합: 5, 곱: -6","D":"합: 6, 곱: 5"}',
     'A', '개념 다지기',
     '근과 계수의 관계: ax²+bx+c=0 에서 (두 근의 합)=-b/a, (두 근의 곱)=c/a 입니다. 여기서 a=1, b=-5, c=6 이므로 합 = -(-5)/1 = 5, 곱 = 6/1 = 6. (실제로 인수분해하면 (x-2)(x-3)=0 → 두 근 2, 3 → 합 5, 곱 6)'),

    (ch_eq, 'MULTIPLE_4',
     '이차방정식 x²-4x+4=0 의 근에 대한 설명으로 옳은 것은?',
     '{"A":"서로 다른 두 실근을 가진다","B":"서로 같은 두 실근(중근)을 가진다","C":"서로 다른 두 허근을 가진다","D":"실근을 가지지 않는다"}',
     'B', '개념 다지기',
     '판별식 D = b²-4ac = (-4)²-4·1·4 = 16-16 = 0. D=0 이면 중근(서로 같은 두 실근)을 가집니다. 실제로 (x-2)²=0 → x=2 (중근).'),

    (ch_eq, 'MULTIPLE_4',
     '이차방정식 x²+4x+k=0 이 서로 다른 두 실근을 가지도록 하는 실수 k 의 값의 범위는?',
     '{"A":"k < 4","B":"k > 4","C":"k < -4","D":"k ≤ 4"}',
     'A', '2~3등급 굳히기',
     '서로 다른 두 실근을 가질 조건은 판별식 D > 0 입니다. D = 4²-4·1·k = 16-4k > 0 → 4k < 16 → k < 4.'),

    (ch_eq, 'MULTIPLE_4',
     '이차방정식 x²-3x+1=0 의 두 근을 α, β 라 할 때, α²+β² 의 값은?',
     '{"A":"5","B":"7","C":"9","D":"11"}',
     'B', '2~3등급 굳히기',
     '근과 계수의 관계로 α+β = 3, αβ = 1. 곱셈 공식 변형 α²+β² = (α+β)²-2αβ = 3²-2·1 = 9-2 = 7.'),

    (ch_eq, 'MULTIPLE_4',
     '이차방정식 x²-6x+k=0 의 두 근 α, β 에 대하여 α²+β²=20 일 때, 상수 k 의 값은?',
     '{"A":"6","B":"7","C":"8","D":"10"}',
     'C', '1등급 도전',
     'α+β = 6, αβ = k. α²+β² = (α+β)²-2αβ = 36-2k = 20 → 2k = 16 → k = 8. (판별식 D=36-4k=4>0 이므로 서로 다른 두 실근 조건도 만족)'),

    (ch_eq, 'MULTIPLE_4',
     '모든 실수 x 에 대하여 부등식 x²-2kx+3k+4>0 이 항상 성립하도록 하는 실수 k 의 값의 범위는?',
     '{"A":"-1 < k < 4","B":"k < -1 또는 k > 4","C":"-4 < k < 1","D":"1 < k < 4"}',
     'A', '1등급 도전',
     'x² 의 계수가 양수이므로 그래프가 아래로 볼록한 포물선입니다. 모든 실수 x 에서 양수이려면 x축과 만나지 않아야 하므로 판별식 D < 0. D/4 = k²-(3k+4) < 0 → k²-3k-4 < 0 → (k-4)(k+1) < 0 → -1 < k < 4.');

  -- ════ UK 실전 문항 — Business Mathematics (복리·감가상각·행렬) ════
  INSERT INTO universal_questions
    (chapter_id, question_type, question_text, options, answer, difficulty, explanation)
  VALUES
    (ch_biz, 'MULTIPLE_4',
     'A sum of £1,000 is invested at 5% per annum compound interest. What is its value after 2 years?',
     '{"A":"£1,100.00","B":"£1,102.50","C":"£1,050.00","D":"£1,025.00"}',
     'B', '하',
     '복리(compound interest)는 매년 원리금 전체에 이자가 붙습니다. 2년 후 가치 = 1000 × (1.05)² = 1000 × 1.1025 = £1,102.50. (단리라면 1000+1000×0.05×2 = £1,100 이지만 복리이므로 이자에 다시 이자가 붙습니다.)'),

    (ch_biz, 'MULTIPLE_4',
     'A machine valued at £20,000 depreciates by 10% per year using the reducing-balance method. What is its value after 2 years?',
     '{"A":"£16,000","B":"£16,200","C":"£18,000","D":"£16,400"}',
     'B', '중',
     '정률(잔액)법 감가상각은 매년 ''남은 가치''에 (1 - 감가율)을 곱합니다. 2년 후 = 20000 × (0.9)² = 20000 × 0.81 = £16,200. (정액법이라면 매년 2000씩 줄어 16000 이지만, reducing-balance 는 잔액 기준입니다.)'),

    (ch_biz, 'MULTIPLE_4',
     'Which expression gives the value of a principal P after t years at an annual compound interest rate r (expressed as a decimal)?',
     '{"A":"P(1 + r)^t","B":"P(1 + rt)","C":"P + rt","D":"P(1 + r/t)"}',
     'A', '중',
     '연 복리에서 t년 후 원리금 = P(1 + r)^t 입니다. P(1 + rt) 는 단리(simple interest) 공식이고, 나머지 보기는 성립하지 않는 식입니다.'),

    (ch_biz, 'MULTIPLE_4',
     'A firm has two assets valued by the vector [£30,000, £18,000] (machine, vehicle). Annual reducing-balance depreciation is applied by multiplying the value vector by the diagonal matrix diag(0.8, 0.75). What is the value vector after 1 year?',
     '{"A":"[£24,000, £13,500]","B":"[£24,000, £14,400]","C":"[£22,000, £13,500]","D":"[£27,000, £13,500]"}',
     'A', '상',
     '대각행렬(diagonal matrix)을 벡터에 곱하면 각 성분에 대응하는 대각 원소가 곱해집니다. 기계: 30000 × 0.8 = 24000 (20% 감가), 차량: 18000 × 0.75 = 13500 (25% 감가). 따라서 1년 후 가치 벡터 = [£24,000, £13,500].'),

    (ch_biz, 'MULTIPLE_4',
     '£5,000 is invested at 4% per annum compound interest for 3 years. How much interest is earned (to the nearest penny)?',
     '{"A":"£600.00","B":"£624.32","C":"£624.00","D":"£620.00"}',
     'B', '중',
     '3년 후 원리금 = 5000 × (1.04)³ = 5000 × 1.124864 = £5,624.32. 따라서 이자(interest) = 5624.32 - 5000 = £624.32. (이자에 이자가 붙는 복리 효과로 단리 £600(=5000×0.04×3)보다 큽니다.)');

  RAISE NOTICE '교과 글로벌 시드 완료: KR 단원 4 + UK 단원 3, KR 문항 6(액센트 난이도) + UK 문항 5.';
END;
$$;
