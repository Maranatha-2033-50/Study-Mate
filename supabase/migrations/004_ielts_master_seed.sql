-- ============================================================
-- 004. IELTS 마스터 도메인 시드 (Reading 1세트 + Writing Task 2)
--   - universal_questions.explanation(한글 해설) + passage(좌측 고정 지문) 컬럼
--   - question_type 에 'ESSAY' 허용
--   - 실전 IELTS Academic 규격(약 700단어) Reading 지문 1 + 객관식 2 + 단답 1
--     → 동일 세트의 모든 문항 Row 에 passage 전체를 100% 동일 복사
--   - IELTS Writing Task 2 에세이 1
--   ⚠️ 수동 마이그레이션: Supabase SQL Editor 에서 실행 (재실행 가능 — 기존 시드 갱신)
--   ※ 지문/문항은 IELTS 포맷에 충실한 오리지널 콘텐츠 (저작권 안전)
-- ============================================================

-- 1. 컬럼 보강
ALTER TABLE universal_questions ADD COLUMN IF NOT EXISTS explanation TEXT;
ALTER TABLE universal_questions ADD COLUMN IF NOT EXISTS passage     TEXT;

-- 2. ESSAY 타입 허용 (기존 CHECK 교체)
ALTER TABLE universal_questions DROP CONSTRAINT IF EXISTS universal_questions_question_type_check;
ALTER TABLE universal_questions
  ADD CONSTRAINT universal_questions_question_type_check
  CHECK (question_type IN ('MULTIPLE_4', 'MULTIPLE_5', 'SHORT_ANSWER', 'ESSAY'));

-- 3. 시드 (재실행 가능: 기존 시드 행 정리 후 재적재)
DO $$
DECLARE
  cat_ielts   UUID;
  ch_reading  UUID;
  ch_writing  UUID;
  seed_titles TEXT[] := ARRAY['Academic Reading — Passage 1', 'Task 2 — Opinion Essay'];
  passage     TEXT;
BEGIN
  -- IELTS 카테고리 확보 (001 에서 생성되었을 수 있음, 없으면 생성)
  SELECT id INTO cat_ielts FROM learning_categories
    WHERE type = 'LANG' AND title = 'IELTS' LIMIT 1;
  IF cat_ielts IS NULL THEN
    cat_ielts := uuid_generate_v4();
    INSERT INTO learning_categories (id, type, title) VALUES (cat_ielts, 'LANG', 'IELTS');
  END IF;

  -- 기존 시드 정리 (의존 attempts → questions → chapters 순서로 삭제)
  DELETE FROM user_attempts WHERE question_id IN (
    SELECT q.id FROM universal_questions q
    JOIN learning_chapters c ON c.id = q.chapter_id
    WHERE c.category_id = cat_ielts AND c.level_2 = ANY(seed_titles)
  );
  DELETE FROM universal_questions WHERE chapter_id IN (
    SELECT id FROM learning_chapters
    WHERE category_id = cat_ielts AND level_2 = ANY(seed_titles)
  );
  DELETE FROM learning_chapters
    WHERE category_id = cat_ielts AND level_2 = ANY(seed_titles);

  -- 챕터 재생성
  ch_reading := uuid_generate_v4();
  ch_writing := uuid_generate_v4();
  INSERT INTO learning_chapters (id, category_id, level_1, level_2) VALUES
    (ch_reading, cat_ielts, 'Reading', 'Academic Reading — Passage 1'),
    (ch_writing, cat_ielts, 'Writing', 'Task 2 — Opinion Essay');

  -- 실전 규격 지문 (약 700단어, 서론-본론-결론) — passage 컬럼 전용 저장
  passage :=
    '## The Science of Urban Trees\n\n' ||
    '**[A]** For most of the twentieth century, the trees that lined city streets were regarded by planners as ornament rather than utility — pleasant to look at, but peripheral to the serious work of building roads, drains and power networks. That view has been steadily dismantled. A substantial body of research now describes the urban forest as a form of "green infrastructure": a living system that delivers services a city would otherwise have to engineer at considerable expense. Understanding how trees provide these services, and why their benefits are so unequally shared, has become central to the way modern cities plan for a warming climate.\n\n' ||
    '**[B]** The most thoroughly documented benefit is temperature regulation. Cities are typically several degrees warmer than the surrounding countryside, a phenomenon known as the urban heat island, caused by the way concrete and asphalt absorb and re-radiate heat. Trees counteract this in two ways. Their canopies provide shade, intercepting sunlight before it can warm paved surfaces; and through a process called evapotranspiration, they release water vapour from their leaves, cooling the surrounding air much as perspiration cools the human body. Field studies in several large cities have recorded temperature differences of up to five degrees Celsius between heavily planted streets and bare ones only a few hundred metres away.\n\n' ||
    '**[C]** Trees also play a measurable role in managing water. When rain falls on a dense canopy, a portion is intercepted by leaves and branches and evaporates before ever reaching the ground. The rest descends more slowly, and the soil around a tree''s roots absorbs water that would otherwise rush across pavement into drainage systems. In this way a single mature street tree can reduce the volume of storm-water runoff a city must process, easing pressure on sewers and lowering the risk of the flash flooding that increasingly accompanies intense rainfall.\n\n' ||
    '**[D]** Less visible, but increasingly valued, is the contribution trees make to air quality. Leaves trap airborne particulate matter on their surfaces, and some species absorb gaseous pollutants such as nitrogen dioxide and ozone. While researchers caution that trees alone cannot solve urban air pollution — and that poorly chosen species can even worsen it by releasing allergenic pollen — the cumulative filtering effect of a large, well-designed urban forest is significant, particularly along busy roads.\n\n' ||
    '**[E]** The benefits extend to human health in subtler ways. A growing number of studies link access to green space with lower rates of stress, faster recovery from illness, and improved concentration. Hospital patients with a view of trees have been shown to recover more quickly than those facing a brick wall, and neighbourhoods with abundant greenery report stronger social ties. Such findings are difficult to quantify in monetary terms, yet they weigh heavily in arguments for protecting and expanding the urban canopy.\n\n' ||
    '**[F]** These advantages are not free. Trees must be planted, watered through their vulnerable early years, pruned, and eventually removed when they die or become hazardous. Roots can crack pavements and invade pipes, and falling limbs pose risks during storms. Economists who have attempted to weigh these costs against the benefits, however, consistently find that mature trees repay the investment many times over — through higher property values, reduced energy bills for nearby buildings, and avoided spending on drainage and cooling. The decisive variable is time: the full return arrives only decades after planting, long after the officials who approved it have left office.\n\n' ||
    '**[G]** Perhaps the most pressing issue is not whether trees are valuable but who receives their benefits. Surveys repeatedly show that wealthier neighbourhoods enjoy far denser tree cover than poorer ones, meaning that the residents most exposed to heat and flooding — and least able to afford air conditioning or insurance — often have the least protection. Correcting this imbalance has become, for many planners, a question of justice as much as of forestry. The science of urban trees, in other words, is no longer simply about biology; it is about how a city chooses to distribute a resource that quietly shapes the comfort, health and safety of everyone who lives among it.';

  -- Reading 문항 3종 — 모든 Row 의 passage 컬럼에 동일 지문 100% 복사
  INSERT INTO universal_questions
    (chapter_id, question_type, question_text, options, answer, difficulty, explanation, passage)
  VALUES
    (ch_reading, 'MULTIPLE_4',
     '**1. Which of the following best expresses the main idea of the passage?**',
     '{"A":"City trees are valued mainly for their decorative appearance.","B":"Trees should replace traditional drainage systems entirely.","C":"Urban trees function as valuable green infrastructure whose benefits are unevenly distributed.","D":"Air conditioning is more effective than trees at cooling cities."}',
     'C', '중',
     '글 전체는 도시의 나무가 단순 장식이 아니라 냉각·빗물 처리·대기질·건강 등 측정 가능한 편익을 주는 ''그린 인프라''이며, 그 혜택이 불균등하게 분배된다는 점을 다룹니다(특히 [A]와 [G]). 따라서 정답은 C. A는 [A]에서 반박되는 옛 통념, B·D는 본문에 없는 과장입니다.',
     passage),

    (ch_reading, 'MULTIPLE_4',
     '**2. According to paragraph C, how do trees help reduce the risk of flooding?**',
     '{"A":"By releasing water vapour into the air","B":"By intercepting rainfall and helping water soak into the soil instead of rushing into drains","C":"By cooling the surrounding streets","D":"By replacing the city''s sewer system"}',
     'B', '하',
     '단락 [C]는 캐노피가 빗물을 가로채 증발시키고, 뿌리 주변 토양이 물을 흡수해 ''배수구로 쏟아질 물''을 줄여 우수 유출량과 돌발 홍수 위험을 낮춘다고 설명합니다. 정답 B. A·C는 [B]의 온도 조절 내용, D는 과장된 진술입니다.',
     passage),

    (ch_reading, 'SHORT_ANSWER',
     '**3. Complete the sentence with ONE WORD from the passage.**\n\nTrees cool the surrounding air by releasing water vapour from their leaves through a process called ______.',
     NULL,
     'evapotranspiration', '중',
     '단락 [B]에 ''through a process called evapotranspiration''이라고 명시됩니다. 잎에서 수증기를 방출해 주변 공기를 식히는 과정으로, 정답은 한 단어 evapotranspiration 입니다. (철자 주의)',
     passage);

  -- Writing Task 2 에세이 (passage 없음)
  INSERT INTO universal_questions
    (chapter_id, question_type, question_text, options, answer, difficulty, explanation, passage)
  VALUES
    (ch_writing, 'ESSAY',
     '## IELTS Writing Task 2\n\nYou should spend about 40 minutes on this task. Write at least 250 words.\n\n**Some people believe that universities should accept equal numbers of male and female students in every subject. To what extent do you agree or disagree?**\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.',
     NULL,
     '', '상',
     '[작성 가이드] ① 서론: 주제를 paraphrase 하고 입장을 명확히. ② 본론 2단락: topic sentence → 근거 → 예시. ③ 결론: 입장 재진술 + 요약. [밴드업] 주술 일치·관사·시제(GRA), outweigh/address an issue 등 학술 collocation(LR), however·moreover 연결어로 응집성(CC). 250자 이상, 40분.',
     NULL);

  RAISE NOTICE 'IELTS master seed refreshed (passage 컬럼 + Reading 3 + Writing 1).';
END;
$$;
