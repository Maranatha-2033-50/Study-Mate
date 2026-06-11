-- ============================================================
-- 004. IELTS 마스터 도메인 시드 (Reading 1세트 + Writing Task 2)
--   - universal_questions.explanation(한글 해설) 컬럼 추가
--   - question_type 에 'ESSAY' 허용
--   - IELTS Academic Reading 지문 1 + 객관식 2 + 단답 1
--   - IELTS Writing Task 2 에세이 주제 1
--   ⚠️ 수동 마이그레이션: Supabase SQL Editor 에서 1회 실행
--   ※ 지문/문항은 IELTS 포맷에 충실한 오리지널 콘텐츠 (저작권 안전)
-- ============================================================

-- 1. 한글 해설 컬럼
ALTER TABLE universal_questions
  ADD COLUMN IF NOT EXISTS explanation TEXT;

-- 2. ESSAY 타입 허용 (기존 CHECK 교체)
ALTER TABLE universal_questions DROP CONSTRAINT IF EXISTS universal_questions_question_type_check;
ALTER TABLE universal_questions
  ADD CONSTRAINT universal_questions_question_type_check
  CHECK (question_type IN ('MULTIPLE_4', 'MULTIPLE_5', 'SHORT_ANSWER', 'ESSAY'));

-- 3. 시드 (멱등: 이미 심었으면 skip)
DO $$
DECLARE
  cat_ielts   UUID;
  ch_reading  UUID;
  ch_writing  UUID;
  passage     TEXT;
BEGIN
  -- IELTS 카테고리 확보 (001 에서 생성되었을 수 있음, 없으면 생성)
  SELECT id INTO cat_ielts FROM learning_categories
    WHERE type = 'LANG' AND title = 'IELTS' LIMIT 1;
  IF cat_ielts IS NULL THEN
    cat_ielts := uuid_generate_v4();
    INSERT INTO learning_categories (id, type, title) VALUES (cat_ielts, 'LANG', 'IELTS');
  END IF;

  -- 멱등 가드: 이미 시드된 경우 종료
  IF EXISTS (
    SELECT 1 FROM learning_chapters
    WHERE category_id = cat_ielts AND level_2 = 'Academic Reading — Passage 1'
  ) THEN
    RAISE NOTICE 'IELTS master seed already present — skipping.';
    RETURN;
  END IF;

  -- 챕터 생성
  ch_reading := uuid_generate_v4();
  ch_writing := uuid_generate_v4();
  INSERT INTO learning_chapters (id, category_id, level_1, level_2) VALUES
    (ch_reading, cat_ielts, 'Reading', 'Academic Reading — Passage 1'),
    (ch_writing, cat_ielts, 'Writing', 'Task 2 — Opinion Essay');

  -- 공용 지문 (오리지널, IELTS Academic 스타일) — 문항마다 지문+질문을 함께 저장.
  -- DiagnosticTestRoom 의 splitContent 가 literal \n 을 개행으로 변환하고
  -- 마지막 단락(질문)을 지문에서 분리한다.
  passage :=
    '## The Science of Urban Trees\n\n' ||
    '**[A]** For most of the twentieth century, trees were treated by city planners as little more than decoration — pleasant to look at, but irrelevant to the serious business of infrastructure. That assumption has been overturned. A growing body of research now treats the urban forest as a piece of critical infrastructure, on a par with drainage systems and power lines.\n\n' ||
    '**[B]** The most measurable benefit is temperature control. Through a process called evapotranspiration, trees release water vapour from their leaves, cooling the surrounding air much as sweating cools the human body. Studies in several large cities have recorded differences of up to five degrees Celsius between heavily planted streets and bare ones only a few hundred metres away.\n\n' ||
    '**[C]** Trees also intercept rainfall. Their canopies slow the descent of water, and their roots help it soak into the soil rather than rushing into overloaded drains. In this way a mature street tree can reduce the volume of storm-water runoff a city must manage, lowering the risk of flash flooding.\n\n' ||
    '**[D]** Yet these benefits are unevenly distributed. Wealthier neighbourhoods tend to have far denser tree cover than poorer ones, meaning the residents who would gain most from cooling and flood protection often receive the least. Correcting this imbalance, many planners argue, is now as much a question of fairness as of forestry.';

  -- Q1: 주제/대의 (MULTIPLE_4, 중)
  INSERT INTO universal_questions (chapter_id, question_type, question_text, options, answer, difficulty, explanation) VALUES
    (ch_reading, 'MULTIPLE_4',
     passage || '\n\n**1. Which of the following best expresses the main idea of the passage?**',
     '{"A":"City trees are valued mainly for their decorative appearance.","B":"Trees should replace traditional drainage systems entirely.","C":"Urban trees function as critical infrastructure with measurable benefits.","D":"Wealthy neighbourhoods plant more trees than poorer ones."}',
     'C', '중',
     '글 전체는 도시의 나무가 단순한 장식이 아니라 온도 조절·빗물 처리 등 측정 가능한 편익을 주는 ''핵심 인프라''라는 주장을 전개합니다. 따라서 정답은 C. A는 단락 A에서 반박되는 옛 통념이고, B(배수시스템 완전 대체)는 과장, D는 단락 D의 세부 내용일 뿐 글 전체의 대의가 아닙니다.'),

    -- Q2: 세부 정보 (MULTIPLE_4, 하)
    (ch_reading, 'MULTIPLE_4',
     passage || '\n\n**2. According to paragraph C, how do trees help reduce the risk of flooding?**',
     '{"A":"By releasing water vapour into the air","B":"By slowing rainfall and helping water soak into the soil","C":"By cooling the surrounding streets","D":"By replacing the city''s storm drains"}',
     'B', '하',
     '단락 C는 나무의 ''캐노피가 빗물의 낙하를 늦추고 뿌리가 물을 토양으로 스며들게 해'' 우수 유출량을 줄인다고 설명합니다. 정답 B. A·C는 단락 B의 온도 조절(증산작용) 내용이고, D는 본문에 없는 과장된 진술입니다.'),

    -- Q3: 단답형 (SHORT_ANSWER, 중)
    (ch_reading, 'SHORT_ANSWER',
     passage || '\n\n**3. Complete the sentence with ONE WORD from the passage.**\n\nTrees cool the surrounding air through a process called ______.',
     NULL,
     'evapotranspiration', '중',
     '단락 B에 ''a process called evapotranspiration''이라고 명시됩니다. 잎에서 수증기를 방출해 주변 공기를 식히는 과정으로, 정답은 한 단어 evapotranspiration 입니다. (철자 주의)');

  -- Writing Task 2 에세이 (ESSAY, 상) — answer 는 NOT NULL 이라 빈 문자열
  INSERT INTO universal_questions (chapter_id, question_type, question_text, options, answer, difficulty, explanation) VALUES
    (ch_writing, 'ESSAY',
     '## IELTS Writing Task 2\n\nYou should spend about 40 minutes on this task. Write at least 250 words.\n\n**Some people believe that universities should accept equal numbers of male and female students in every subject. To what extent do you agree or disagree?**\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.',
     NULL,
     '', '상',
     '[작성 가이드] ① 서론: 주제를 바꿔 말하고(paraphrase) 본인 입장을 명확히 제시하세요. ② 본론 2단락: 각 단락은 하나의 핵심 논거 + 근거 + 예시(topic sentence → explanation → example) 구조로. ③ 결론: 입장 재진술 + 논거 요약. [밴드업 포인트] 주술 일치·관사·시제 정확성(GRA), outweigh/address 등 학술 collocation(LR), however·moreover 등 연결어로 응집성(CC) 확보. 250자 이상, 40분 내 완성 목표.');

  RAISE NOTICE 'IELTS master seed inserted (Reading 3 + Writing 1).';
END;
$$;
