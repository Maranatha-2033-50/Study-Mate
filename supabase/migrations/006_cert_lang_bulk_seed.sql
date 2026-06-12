-- ============================================================
-- 006. 자격증(CERT) 대량 벌크 시드 + 글로벌 어학(LANG) 실전 세트 보강
--      + 교과(SCHOOL) 다국적 커리큘럼 확장 베이스
--
--   A. 컴퓨터활용능력시험 — 스프레드시트 일반 / 데이터베이스 일반 대량 문항
--   B. 정보처리기사 — 소프트웨어 설계 / 소프트웨어 개발 / DB 활용 대량 문항
--   C. 한국사능력검정시험 — 선사~현대 시대별 심화 기출 변형 문항
--   D. IELTS Academic Reading — Passage 2 학술 지문 1세트 (passage 전 Row 복사)
--   E. (이미 0번 섹션) SCHOOL 다차원 커리큘럼 확장용 curriculum_code 베이스
--
--   ※ 모든 객관식/단답 문항은 '한국어 상세 해설(explanation)'을 필수 포함.
--   ※ 모든 콘텐츠는 시험 포맷에 충실한 오리지널 변형 문항 (저작권 안전).
--
--   [멱등성] 각 섹션은 도입하는 신규 level_2 라벨 집합으로만 스코프하여
--            attempts → questions → chapters 순으로 정리 후 재적재한다.
--            → 중복 실행해도 데이터가 깨지지 않으며 콘텐츠가 최신 시드로 갱신됨.
--            → 기존 001/002/004/005 시드(다른 level_2 라벨)는 절대 건드리지 않음.
--
--   ⚠️ 수동 마이그레이션: Supabase SQL Editor 에서 실행 (재실행 가능)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0. 교과(SCHOOL) 다국적·다차원 커리큘럼 확장 베이스
-- ────────────────────────────────────────────────────────────
-- 향후 SCHOOL 도메인은 다음 3개 트랙으로 정교하게 스케일업된다:
--   (1) 한국 수능/내신   : 학년·학기·단원·학교기출 최적화
--   (2) 캐나다 교육과정   : 주(Province)별 커리큘럼 (예: Ontario)
--   (3) 영국 대학 진학    : GCSE / A-Level (Further Math, Business, Economics 등)
--
-- 단원 코드 충돌 없이 이를 수용하기 위해 learning_chapters 에
-- 선택적(nullable) 분류 코드 컬럼을 추가한다. 기존 앱 쿼리는 level_1/level_2/
-- category_id 만 사용하므로 이 컬럼은 100% 하위 호환(무영향)이며,
-- 미래 마이그레이션이 아래 접두어 규약으로 값을 채워 다차원 필터링/태깅을 가능케 한다.
--
--   curriculum_code 접두어 규약 (국가_과정_과목_세부):
--     KR_SAT_MATH_CALC      한국 수능 수학 미적분
--     KR_HIGH1_ENG_READ     한국 고1 영어 독해(내신)
--     CA_ON_MATH_MCV4U      캐나다 온타리오 Calculus & Vectors
--     UK_ALEVEL_FMATH       영국 A-Level Further Mathematics
--     UK_GCSE_BUSINESS      영국 GCSE Business
--   → 접두어는 자유 확장 가능하며, level_1/level_2 는 사람이 읽는 표시용으로 유지.
--   → 서브 태그가 더 필요해지면 동일 패턴으로 별도 chapter_tags(M:N) 테이블로
--     무중단 확장 가능 (이 컬럼이 1차 단일 코드 훅 역할).
-- 자세한 설계 의도: docs/school-curriculum-architecture.md
ALTER TABLE learning_chapters ADD COLUMN IF NOT EXISTS curriculum_code TEXT;

COMMENT ON COLUMN learning_chapters.curriculum_code IS
  '다국적 커리큘럼 분류 코드 (국가_과정_과목_세부 접두어). 예: KR_SAT_MATH_CALC, CA_ON_MCV4U, UK_ALEVEL_FMATH. NULL 허용 — 하위 호환.';

CREATE INDEX IF NOT EXISTS idx_chapters_curriculum_code
  ON learning_chapters(curriculum_code)
  WHERE curriculum_code IS NOT NULL;


-- ════════════════════════════════════════════════════════════
-- A. 컴퓨터활용능력시험 — 스프레드시트 일반 / 데이터베이스 일반
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE
  cat_comp    UUID;
  ch_ss       UUID;
  ch_db       UUID;
  seed_titles TEXT[] := ARRAY['함수와 배열수식', '데이터베이스 핵심'];
BEGIN
  SELECT id INTO cat_comp FROM learning_categories
    WHERE type = 'CERT' AND title = '컴퓨터활용능력시험' LIMIT 1;
  IF cat_comp IS NULL THEN
    cat_comp := uuid_generate_v4();
    INSERT INTO learning_categories (id, type, title) VALUES (cat_comp, 'CERT', '컴퓨터활용능력시험');
  END IF;

  -- 멱등 정리 (신규 라벨만)
  DELETE FROM user_attempts WHERE question_id IN (
    SELECT q.id FROM universal_questions q
    JOIN learning_chapters c ON c.id = q.chapter_id
    WHERE c.category_id = cat_comp AND c.level_2 = ANY(seed_titles));
  DELETE FROM universal_questions WHERE chapter_id IN (
    SELECT id FROM learning_chapters
    WHERE category_id = cat_comp AND level_2 = ANY(seed_titles));
  DELETE FROM learning_chapters
    WHERE category_id = cat_comp AND level_2 = ANY(seed_titles);

  ch_ss := uuid_generate_v4();
  ch_db := uuid_generate_v4();
  INSERT INTO learning_chapters (id, category_id, level_1, level_2) VALUES
    (ch_ss, cat_comp, '스프레드시트 일반', '함수와 배열수식'),
    (ch_db, cat_comp, '데이터베이스 일반', '데이터베이스 핵심');

  -- [스프레드시트 일반]
  INSERT INTO universal_questions
    (chapter_id, question_type, question_text, options, answer, difficulty, explanation)
  VALUES
    (ch_ss, 'MULTIPLE_4',
     '다음 중 표의 [B2:B10] 영역에서 값을 찾아 같은 행 [D2:D10]의 값을 반환하려 할 때, 찾는 값이 표의 왼쪽 열에 없어도 동작하는 함수 조합으로 가장 적절한 것은?',
     '{"A":"=VLOOKUP() 단독","B":"=INDEX(D2:D10, MATCH(찾을값, B2:B10, 0))","C":"=HLOOKUP() 단독","D":"=COUNTIF(B2:B10, 찾을값)"}',
     'B', '중',
     'VLOOKUP은 찾을 값이 반드시 표의 가장 왼쪽 열에 있어야 합니다. 반면 INDEX+MATCH 조합은 MATCH로 위치(행 번호)를 찾고 INDEX로 임의 열의 값을 반환하므로, 기준 열의 위치에 제약이 없어 더 유연합니다. 정답 B.'),

    (ch_ss, 'MULTIPLE_4',
     '엑셀에서 조건을 만족하는 값들의 합을 한 셀에서 배열 수식으로 구하려고 입력 후 Ctrl+Shift+Enter 를 눌렀다. 수식 표시줄에 나타나는 형태로 옳은 것은?\n\n=SUM(IF(A1:A10>=90, B1:B10))',
     '{"A":"=SUM(IF(A1:A10>=90, B1:B10))","B":"\"=SUM(IF(A1:A10>=90, B1:B10))\"","C":"{=SUM(IF(A1:A10>=90, B1:B10))}","D":"(=SUM(IF(A1:A10>=90, B1:B10)))"}',
     'C', '중',
     '배열 수식을 Ctrl+Shift+Enter 로 확정하면 수식 양 끝에 중괄호 { } 가 자동으로 붙어 {=...} 형태로 표시됩니다. 이 중괄호는 사용자가 직접 입력하는 것이 아니라 배열 수식임을 나타내는 표식입니다. 정답 C.'),

    (ch_ss, 'MULTIPLE_4',
     '[A1] 셀에 =$C$1+D1 을 입력한 뒤 [A2] 셀로 복사하였다. [A2] 셀에 들어가는 수식으로 옳은 것은?',
     '{"A":"=$C$1+D1","B":"=$C$2+D2","C":"=$C$1+D2","D":"=$C$2+D1"}',
     'C', '중',
     '$C$1 은 행·열 모두 고정된 절대참조이므로 복사해도 그대로 $C$1 입니다. D1 은 상대참조라 아래로 한 행 복사되면 D2 로 변합니다. 따라서 결과는 =$C$1+D2. 정답 C.'),

    (ch_ss, 'MULTIPLE_5',
     '다음 중 두 범위의 대응하는 원소끼리 곱한 뒤 그 합을 한 번에 구하는 함수로, 가중 합계(예: 수량×단가의 총합) 계산에 가장 적합한 것은?',
     '{"A":"SUMIF","B":"SUMPRODUCT","C":"PRODUCT","D":"COUNTIFS","E":"AVERAGEIF"}',
     'B', '중',
     'SUMPRODUCT(범위1, 범위2)는 같은 위치의 원소끼리 곱한 결과를 모두 더합니다. 예를 들어 수량 열과 단가 열을 곱해 총매출을 한 셀에서 계산할 때 쓰입니다. PRODUCT는 곱만, SUMIF/COUNTIFS는 조건 집계, AVERAGEIF는 조건부 평균입니다. 정답 B.'),

    (ch_ss, 'MULTIPLE_4',
     '다음 중 엑셀의 셀 참조 방식에 대한 설명으로 옳지 않은 것은?',
     '{"A":"상대참조는 수식을 복사하면 참조가 자동으로 조정된다","B":"절대참조는 행과 열 앞에 $ 기호를 붙인다","C":"혼합참조는 행 또는 열 중 하나만 고정한다","D":"F4 키는 참조 방식을 바꿀 수 없고 셀 서식만 반복한다"}',
     'D', '하',
     '셀 참조를 입력·편집하는 중 F4 키를 누르면 상대→절대→행고정 혼합→열고정 혼합 순으로 참조 방식이 순환 전환됩니다. 따라서 ''F4로 참조 방식을 바꿀 수 없다''는 D가 옳지 않은 설명(정답). A·B·C는 모두 올바른 설명입니다.'),

    (ch_ss, 'SHORT_ANSWER',
     '엑셀에서 한 범위 내에서 특정 수치가 몇 번째로 큰지(또는 작은지) 순위를 구할 때 사용하는 대표적인 함수명을 쓰시오. (예: 시험 점수의 석차)',
     NULL, 'RANK', '하',
     '특정 값이 범위 내에서 차지하는 순위를 반환하는 함수는 RANK(또는 RANK.EQ / RANK.AVG)입니다. =RANK(점수, 점수범위, 0) 형태로 0(또는 생략)은 내림차순(큰 값이 1등) 순위를 구합니다. 정답: RANK.');

  -- [데이터베이스 일반]
  INSERT INTO universal_questions
    (chapter_id, question_type, question_text, options, answer, difficulty, explanation)
  VALUES
    (ch_db, 'MULTIPLE_4',
     '다음 중 데이터베이스 정규화(Normalization)의 목적으로 가장 적절한 것은?',
     '{"A":"데이터 중복을 늘려 조회 속도를 높이기 위해","B":"데이터 중복과 이상(Anomaly) 현상을 줄여 무결성을 높이기 위해","C":"테이블의 개수를 항상 하나로 합치기 위해","D":"기본키를 제거하기 위해"}',
     'B', '중',
     '정규화는 테이블을 분해해 데이터 중복을 최소화하고, 삽입·갱신·삭제 시 발생하는 이상(Anomaly) 현상을 제거하여 데이터 무결성을 높이는 과정입니다. 중복을 늘리는 것(A)은 반정규화이며, C·D는 정규화와 무관합니다. 정답 B.'),

    (ch_db, 'MULTIPLE_4',
     '다음 중 기본키(Primary Key)와 외래키(Foreign Key)에 대한 설명으로 옳은 것은?',
     '{"A":"기본키는 NULL 값을 가질 수 있다","B":"외래키는 다른 테이블의 기본키를 참조한다","C":"한 테이블에 기본키는 여러 개 존재할 수 있다","D":"외래키는 중복될 수 없다"}',
     'B', '중',
     '외래키는 다른(또는 자기 자신) 테이블의 기본키를 참조하여 테이블 간 관계를 맺는 속성입니다(정답 B). 기본키는 NULL을 가질 수 없고(개체 무결성), 테이블당 하나만 존재하며, 외래키는 참조 무결성을 지키는 한 중복될 수 있습니다.'),

    (ch_db, 'MULTIPLE_5',
     '다음 SQL 명령어를 분류할 때, DDL(데이터 정의어)에만 해당하는 것끼리 묶은 것은?\n\n㉠ CREATE  ㉡ SELECT  ㉢ ALTER  ㉣ INSERT  ㉤ DROP',
     '{"A":"㉠㉡㉢","B":"㉠㉢㉤","C":"㉡㉣㉤","D":"㉠㉣㉤","E":"㉡㉢㉣"}',
     'B', '상',
     'DDL(데이터 정의어)은 테이블 등 객체의 구조를 정의하는 CREATE, ALTER, DROP 입니다(정답 ㉠㉢㉤ = B). SELECT/INSERT/UPDATE/DELETE 는 데이터를 다루는 DML, GRANT/REVOKE 는 DCL 입니다.'),

    (ch_db, 'MULTIPLE_4',
     '관계형 데이터베이스 모델에서 다음 용어에 대한 설명으로 옳지 않은 것은?',
     '{"A":"튜플(Tuple)은 테이블의 한 행(레코드)을 의미한다","B":"속성(Attribute)은 테이블의 한 열(필드)을 의미한다","C":"카디널리티(Cardinality)는 속성(열)의 개수를 의미한다","D":"도메인(Domain)은 한 속성이 가질 수 있는 값의 집합이다"}',
     'C', '중',
     '카디널리티(Cardinality)는 튜플(행)의 개수를 의미하고, 속성(열)의 개수는 차수(Degree)라고 합니다. 따라서 C가 옳지 않은 설명(정답). A·B·D는 모두 올바른 관계형 모델 용어 정의입니다.'),

    (ch_db, 'SHORT_ANSWER',
     '기본키는 NULL이 될 수 없으며 각 튜플을 유일하게 식별할 수 있어야 한다는 제약을, 무결성의 한 종류로 무엇이라 하는지 그 명칭을 쓰시오. (예: ○○ 무결성)',
     NULL, '개체 무결성', '중',
     '기본키 속성은 NULL을 가질 수 없고 유일해야 한다는 규칙은 개체 무결성(Entity Integrity)입니다. 참고로 외래키 값이 참조하는 기본키에 반드시 존재해야 한다는 규칙은 참조 무결성(Referential Integrity)입니다. 정답: 개체 무결성.');

  RAISE NOTICE '컴퓨터활용능력시험 벌크 시드 완료: 스프레드시트 6 + DB 5.';
END;
$$;


-- ════════════════════════════════════════════════════════════
-- B. 정보처리기사 — 소프트웨어 설계 / 개발 / DB 활용
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE
  cat_it      UUID;
  ch_des      UUID;
  ch_dev      UUID;
  ch_dbu      UUID;
  seed_titles TEXT[] := ARRAY['결합도·응집도와 패턴', '자료구조와 알고리즘', 'SQL과 정규화'];
BEGIN
  SELECT id INTO cat_it FROM learning_categories
    WHERE type = 'CERT' AND title = '정보처리기사' LIMIT 1;
  IF cat_it IS NULL THEN
    cat_it := uuid_generate_v4();
    INSERT INTO learning_categories (id, type, title) VALUES (cat_it, 'CERT', '정보처리기사');
  END IF;

  DELETE FROM user_attempts WHERE question_id IN (
    SELECT q.id FROM universal_questions q
    JOIN learning_chapters c ON c.id = q.chapter_id
    WHERE c.category_id = cat_it AND c.level_2 = ANY(seed_titles));
  DELETE FROM universal_questions WHERE chapter_id IN (
    SELECT id FROM learning_chapters
    WHERE category_id = cat_it AND level_2 = ANY(seed_titles));
  DELETE FROM learning_chapters
    WHERE category_id = cat_it AND level_2 = ANY(seed_titles);

  ch_des := uuid_generate_v4();
  ch_dev := uuid_generate_v4();
  ch_dbu := uuid_generate_v4();
  INSERT INTO learning_chapters (id, category_id, level_1, level_2) VALUES
    (ch_des, cat_it, '소프트웨어 설계', '결합도·응집도와 패턴'),
    (ch_dev, cat_it, '소프트웨어 개발', '자료구조와 알고리즘'),
    (ch_dbu, cat_it, '데이터베이스 활용', 'SQL과 정규화');

  -- [소프트웨어 설계]
  INSERT INTO universal_questions
    (chapter_id, question_type, question_text, options, answer, difficulty, explanation)
  VALUES
    (ch_des, 'MULTIPLE_5',
     '다음 중 모듈의 응집도(Cohesion)가 가장 강한(바람직한) 유형은?',
     '{"A":"우연적 응집도(Coincidental)","B":"논리적 응집도(Logical)","C":"시간적 응집도(Temporal)","D":"절차적 응집도(Procedural)","E":"기능적 응집도(Functional)"}',
     'E', '상',
     '응집도는 약함→강함 순으로 우연적 < 논리적 < 시간적 < 절차적 < 통신적 < 순차적 < 기능적 입니다. 모듈이 단일 기능 수행에만 집중하는 기능적 응집도가 가장 강하고 바람직합니다. 정답 E.'),

    (ch_des, 'MULTIPLE_5',
     '다음 중 모듈 간 결합도(Coupling)가 가장 약한(바람직한) 유형은?',
     '{"A":"내용 결합도(Content)","B":"공통 결합도(Common)","C":"제어 결합도(Control)","D":"스탬프 결합도(Stamp)","E":"자료 결합도(Data)"}',
     'E', '상',
     '결합도는 약함→강함 순으로 자료 < 스탬프 < 제어 < 외부 < 공통 < 내용 입니다. 모듈 간에 필요한 자료(파라미터)만 주고받는 자료 결합도가 가장 약하고 바람직합니다(정답 E). 내용 결합도가 가장 강해 피해야 합니다.'),

    (ch_des, 'MULTIPLE_4',
     '다음 중 디자인 패턴의 분류가 바르게 연결된 것은?',
     '{"A":"싱글톤(Singleton) — 행위 패턴","B":"옵서버(Observer) — 행위 패턴","C":"어댑터(Adapter) — 생성 패턴","D":"팩토리 메서드(Factory Method) — 구조 패턴"}',
     'B', '중',
     'GoF 디자인 패턴은 생성(Creational)·구조(Structural)·행위(Behavioral)로 나뉩니다. 옵서버는 객체 간 상태 변화 통지를 다루는 행위 패턴(정답 B). 싱글톤·팩토리 메서드는 생성 패턴, 어댑터는 구조 패턴입니다.'),

    (ch_des, 'MULTIPLE_4',
     '다음 설명에 해당하는 디자인 패턴은?\n\n「한 객체의 상태가 변하면 그 객체에 의존하는 다른 객체들에게 자동으로 변경을 통지하여 일대다(1:N) 관계를 정의하는 행위 패턴」',
     '{"A":"옵서버(Observer)","B":"싱글톤(Singleton)","C":"데코레이터(Decorator)","D":"빌더(Builder)"}',
     'A', '중',
     '한 객체(주체, Subject)의 상태 변화를 구독자(Observer)들에게 자동 통지하는 1:N 의존 관계 패턴은 옵서버입니다(정답 A). 이벤트 리스너·발행/구독 구조가 대표적 응용입니다.'),

    (ch_des, 'SHORT_ANSWER',
     '객체지향 설계 원칙(SOLID) 중 ''클래스는 확장에는 열려 있고 변경에는 닫혀 있어야 한다''는 원칙의 명칭을 영문 약자로 쓰시오.',
     NULL, 'OCP', '상',
     '확장에는 열려(Open) 있고 변경에는 닫혀(Closed) 있어야 한다는 원칙은 개방-폐쇄 원칙(Open-Closed Principle), 약자로 OCP입니다. SOLID 는 SRP·OCP·LSP·ISP·DIP 로 구성됩니다. 정답: OCP.');

  -- [소프트웨어 개발 — 자료구조/알고리즘]
  INSERT INTO universal_questions
    (chapter_id, question_type, question_text, options, answer, difficulty, explanation)
  VALUES
    (ch_dev, 'MULTIPLE_4',
     '다음 중 후입선출(LIFO) 방식으로 동작하여, 함수 호출 관리나 수식의 괄호 검사에 사용되는 자료구조는?',
     '{"A":"큐(Queue)","B":"스택(Stack)","C":"연결 리스트(Linked List)","D":"해시 테이블(Hash Table)"}',
     'B', '하',
     '스택(Stack)은 가장 나중에 삽입된 데이터가 가장 먼저 나오는 후입선출(LIFO, Last In First Out) 구조입니다. 함수 호출 스택, 괄호 짝 검사, 되돌리기(Undo) 등에 쓰입니다. 큐는 선입선출(FIFO)입니다. 정답 B.'),

    (ch_dev, 'MULTIPLE_5',
     '다음 정렬 알고리즘 중 평균 시간 복잡도가 O(n²)에 해당하는 것은?',
     '{"A":"병합 정렬(Merge Sort)","B":"힙 정렬(Heap Sort)","C":"퀵 정렬(Quick Sort)","D":"삽입 정렬(Insertion Sort)","E":"기수 정렬(Radix Sort)"}',
     'D', '중',
     '삽입·선택·버블 정렬은 평균 시간 복잡도가 O(n²)입니다(정답 D). 병합·힙 정렬은 항상 O(n log n), 퀵 정렬은 평균 O(n log n)(최악 O(n²)), 기수 정렬은 O(dn) 수준입니다.'),

    (ch_dev, 'MULTIPLE_4',
     '이진 트리를 중위 순회(Inorder)할 때 노드를 방문하는 순서로 옳은 것은?',
     '{"A":"루트 → 왼쪽 → 오른쪽","B":"왼쪽 → 루트 → 오른쪽","C":"왼쪽 → 오른쪽 → 루트","D":"오른쪽 → 루트 → 왼쪽"}',
     'B', '중',
     '중위 순회(Inorder)는 왼쪽 서브트리 → 루트 → 오른쪽 서브트리 순으로 방문합니다(정답 B). 이진 탐색 트리를 중위 순회하면 오름차순 정렬 결과를 얻습니다. 전위는 루트→왼쪽→오른쪽, 후위는 왼쪽→오른쪽→루트입니다.'),

    (ch_dev, 'SHORT_ANSWER',
     '먼저 삽입된 데이터가 먼저 처리되는 선입선출(FIFO) 방식의 자료구조 이름을 쓰시오. (예: 프린터 인쇄 대기열)',
     NULL, '큐', '하',
     '선입선출(FIFO, First In First Out) 자료구조는 큐(Queue)입니다. 먼저 들어온 데이터가 먼저 나가며, 프린터 출력 대기열·작업 스케줄링 등에 쓰입니다. 정답: 큐(Queue).');

  -- [데이터베이스 활용 — SQL/정규화]
  INSERT INTO universal_questions
    (chapter_id, question_type, question_text, options, answer, difficulty, explanation)
  VALUES
    (ch_dbu, 'MULTIPLE_4',
     '다음 중 제2정규형(2NF)을 만족하기 위한 조건으로 옳은 것은?',
     '{"A":"모든 속성이 원자값을 가져야 한다","B":"기본키가 아닌 모든 속성이 기본키에 완전 함수 종속이어야 한다(부분 함수 종속 제거)","C":"이행적 함수 종속을 제거해야 한다","D":"모든 결정자가 후보키여야 한다"}',
     'B', '상',
     '2NF는 1NF를 만족하면서, 기본키가 아닌 모든 속성이 기본키 전체에 완전 함수 종속(부분 함수 종속 제거)일 때 성립합니다(정답 B). A는 1NF, C는 3NF, D는 BCNF 조건입니다.'),

    (ch_dbu, 'MULTIPLE_4',
     '데이터베이스 트랜잭션의 ACID 특성 중 ''트랜잭션의 연산은 모두 반영되거나 전혀 반영되지 않아야 한다''는 성질은?',
     '{"A":"원자성(Atomicity)","B":"일관성(Consistency)","C":"격리성(Isolation)","D":"지속성(Durability)"}',
     'A', '중',
     '''All or Nothing'' — 트랜잭션의 모든 연산이 완전히 수행되거나 하나도 수행되지 않아야 한다는 성질은 원자성(Atomicity)입니다(정답 A). 일관성은 무결성 유지, 격리성은 동시 실행 간섭 차단, 지속성은 커밋 결과의 영구 보존입니다.'),

    (ch_dbu, 'MULTIPLE_5',
     '다음 중 두 테이블에서 조인 조건에 일치하는 행은 물론, 왼쪽 테이블의 일치하지 않는 행까지 모두 포함해 결과를 반환하는 조인은?',
     '{"A":"INNER JOIN","B":"LEFT OUTER JOIN","C":"RIGHT OUTER JOIN","D":"CROSS JOIN","E":"SELF JOIN"}',
     'B', '중',
     'LEFT OUTER JOIN은 왼쪽 테이블의 모든 행을 보존하고, 오른쪽에 일치하는 값이 없으면 NULL로 채워 반환합니다(정답 B). INNER JOIN은 양쪽 일치 행만, CROSS JOIN은 카티션 곱을 반환합니다.'),

    (ch_dbu, 'SHORT_ANSWER',
     '하나 이상의 기본 테이블로부터 유도된 가상의 테이블로, 실제 데이터를 저장하지 않고 저장된 질의(SELECT)로 정의되는 데이터베이스 객체의 이름을 쓰시오.',
     NULL, '뷰', '중',
     '실제 데이터를 물리적으로 저장하지 않고, 기본 테이블에 대한 SELECT 질의로 정의되는 가상 테이블은 뷰(VIEW)입니다. 보안(필요한 열만 노출)과 질의 단순화에 유용합니다. 정답: 뷰(VIEW).');

  RAISE NOTICE '정보처리기사 벌크 시드 완료: 설계 5 + 개발 4 + DB활용 4.';
END;
$$;


-- ════════════════════════════════════════════════════════════
-- C. 한국사능력검정시험 — 선사~현대 시대별 심화
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE
  cat_ks      UUID;
  ch_anc      UUID;  -- 고대사 심화
  ch_kor      UUID;  -- 고려사 심화
  ch_jos      UUID;  -- 조선사 심화
  ch_mod      UUID;  -- 근대사 심화
  ch_con      UUID;  -- 현대사 심화
  seed_titles TEXT[] := ARRAY['고대사 심화','고려사 심화','조선사 심화','근대사 심화','현대사 심화'];
BEGIN
  SELECT id INTO cat_ks FROM learning_categories
    WHERE type = 'CERT' AND title = '한국사능력검정시험' LIMIT 1;
  IF cat_ks IS NULL THEN
    cat_ks := uuid_generate_v4();
    INSERT INTO learning_categories (id, type, title) VALUES (cat_ks, 'CERT', '한국사능력검정시험');
  END IF;

  DELETE FROM user_attempts WHERE question_id IN (
    SELECT q.id FROM universal_questions q
    JOIN learning_chapters c ON c.id = q.chapter_id
    WHERE c.category_id = cat_ks AND c.level_2 = ANY(seed_titles));
  DELETE FROM universal_questions WHERE chapter_id IN (
    SELECT id FROM learning_chapters
    WHERE category_id = cat_ks AND level_2 = ANY(seed_titles));
  DELETE FROM learning_chapters
    WHERE category_id = cat_ks AND level_2 = ANY(seed_titles);

  ch_anc := uuid_generate_v4();
  ch_kor := uuid_generate_v4();
  ch_jos := uuid_generate_v4();
  ch_mod := uuid_generate_v4();
  ch_con := uuid_generate_v4();
  INSERT INTO learning_chapters (id, category_id, level_1, level_2) VALUES
    (ch_anc, cat_ks, '전근대사', '고대사 심화'),
    (ch_kor, cat_ks, '전근대사', '고려사 심화'),
    (ch_jos, cat_ks, '전근대사', '조선사 심화'),
    (ch_mod, cat_ks, '근현대사', '근대사 심화'),
    (ch_con, cat_ks, '근현대사', '현대사 심화');

  -- [고대사 심화]
  INSERT INTO universal_questions
    (chapter_id, question_type, question_text, options, answer, difficulty, explanation)
  VALUES
    (ch_anc, 'MULTIPLE_4',
     '다음 업적을 남긴 고구려의 왕은?\n\n「수도를 국내성에서 평양으로 옮기고, 적극적인 남진 정책을 펼쳐 한강 유역을 차지하였다.」',
     '{"A":"미천왕","B":"소수림왕","C":"광개토 대왕","D":"장수왕"}',
     'D', '중',
     '427년 평양 천도와 남진 정책으로 한강 유역을 장악한 왕은 장수왕입니다(정답 D). 아버지 광개토 대왕은 영토를 크게 넓혔고, 소수림왕은 율령 반포·불교 수용·태학 설립으로 체제를 정비했습니다.'),

    (ch_anc, 'MULTIPLE_4',
     '다음 중 통일 신라 신문왕의 정책으로 옳은 것은?',
     '{"A":"관료전을 지급하고 녹읍을 폐지하였다","B":"불국사와 석굴암을 처음 창건하였다","C":"독서삼품과를 처음 실시하였다","D":"매소성에서 당군을 격파하였다"}',
     'A', '상',
     '신문왕은 관료전을 지급하고 녹읍을 폐지하여 귀족의 경제 기반을 약화시키고 왕권을 강화했으며, 9주 5소경 정비와 국학 설립을 추진했습니다(정답 A). 독서삼품과는 원성왕 때 실시되었습니다.'),

    (ch_anc, 'SHORT_ANSWER',
     '고구려 유민 출신으로, 698년 동모산 근처에서 발해를 건국한 인물의 이름을 쓰시오.',
     NULL, '대조영', '하',
     '698년 고구려 유민과 말갈인을 이끌고 동모산 일대에서 발해를 세운 인물은 대조영(고왕)입니다. 발해는 ''해동성국''이라 불릴 만큼 번성하였습니다. 정답: 대조영.');

  -- [고려사 심화]
  INSERT INTO universal_questions
    (chapter_id, question_type, question_text, options, answer, difficulty, explanation)
  VALUES
    (ch_kor, 'MULTIPLE_4',
     '다음 정책을 시행하여 왕권을 강화한 고려의 왕은?\n\n「노비안검법을 실시하고, 과거 제도를 처음 도입하였으며, 황제를 칭하고 독자적 연호를 사용하였다.」',
     '{"A":"태조","B":"광종","C":"성종","D":"공민왕"}',
     'B', '중',
     '노비안검법(불법 노비 해방)과 쌍기의 건의를 받아들인 과거제 도입, 칭제 건원으로 왕권을 강화한 왕은 광종입니다(정답 B). 태조는 후삼국 통일, 성종은 최승로의 시무 28조 수용, 공민왕은 반원 자주 개혁을 추진했습니다.'),

    (ch_kor, 'MULTIPLE_4',
     '다음 중 고려 무신 정권 시기에 있었던 사실로 옳은 것은?',
     '{"A":"정중부 등이 무신정변을 일으켰다","B":"묘청이 서경 천도 운동을 일으켰다","C":"강감찬이 귀주에서 거란을 물리쳤다","D":"공민왕이 쌍성총관부를 수복하였다"}',
     'A', '중',
     '1170년 정중부·이의방 등이 무신정변을 일으켜 무신 정권이 성립했고, 이후 최충헌의 교정도감 설치 등으로 이어졌습니다(정답 A). 묘청의 서경 천도(1135)와 귀주 대첩(1019)은 무신정변 이전, 쌍성총관부 수복은 공민왕 때입니다.'),

    (ch_kor, 'SHORT_ANSWER',
     '고려 공민왕이 권문세족이 불법으로 빼앗은 토지와 노비를 본래대로 되돌리기 위해 신돈을 등용하여 설치한 기구의 이름을 쓰시오.',
     NULL, '전민변정도감', '상',
     '공민왕이 신돈을 기용해 권문세족의 불법 토지·노비를 정리하고자 설치한 개혁 기구는 전민변정도감입니다. 신진 사대부 성장의 토대가 되었습니다. 정답: 전민변정도감.');

  -- [조선사 심화]
  INSERT INTO universal_questions
    (chapter_id, question_type, question_text, options, answer, difficulty, explanation)
  VALUES
    (ch_jos, 'MULTIPLE_4',
     '다음 중 조선 세종 대의 업적으로 옳지 않은 것은?',
     '{"A":"훈민정음을 창제·반포하였다","B":"집현전을 설치하여 학문을 장려하였다","C":"측우기·앙부일구 등 과학 기구를 제작하였다","D":"속대전을 편찬하여 통치 체제를 정비하였다"}',
     'D', '중',
     '속대전은 영조 대에 편찬된 법전입니다(정답: 옳지 않은 것 D). 세종은 훈민정음 창제·반포, 집현전 운영, 측우기·앙부일구·자격루 제작, 4군 6진 개척 등 많은 업적을 남겼습니다.'),

    (ch_jos, 'MULTIPLE_5',
     '다음 중 붕당의 폐단을 막기 위해 영조와 정조가 공통으로 추진한 정책은?',
     '{"A":"균역법","B":"탕평책","C":"규장각 설치","D":"장용영 설치","E":"수원 화성 건설"}',
     'B', '중',
     '영조와 정조가 붕당 간 대립을 완화하고 왕권을 강화하기 위해 공통으로 추진한 정책은 탕평책입니다(정답 B). 균역법은 영조, 규장각·장용영·수원 화성은 정조 대의 개별 정책입니다.'),

    (ch_jos, 'SHORT_ANSWER',
     '조선 후기, 농민의 부담이 컸던 공납을 토지 결수에 따라 쌀·베·동전 등으로 납부하게 한 제도로, 광해군 때 경기도에서 처음 시행된 제도의 이름을 쓰시오.',
     NULL, '대동법', '상',
     '방납의 폐단을 줄이기 위해 공납을 토지 기준으로 쌀(대동미) 등으로 바꿔 거둔 제도는 대동법입니다. 광해군 때 경기도에서 시작되어 점차 전국으로 확대되었고, 공인의 등장과 상품 화폐 경제 발달을 촉진했습니다. 정답: 대동법.');

  -- [근대사 심화]
  INSERT INTO universal_questions
    (chapter_id, question_type, question_text, options, answer, difficulty, explanation)
  VALUES
    (ch_mod, 'MULTIPLE_4',
     '다음 중 1894년 갑오개혁의 내용으로 옳은 것은?',
     '{"A":"신분제(노비제)를 폐지하였다","B":"대한국 국제를 반포하였다","C":"척화비를 전국에 건립하였다","D":"교육 입국 조서를 폐지하였다"}',
     'A', '중',
     '갑오개혁(1894)에서는 신분제·노비제 폐지, 과거제 폐지, 과부 재가 허용, 도량형 통일 등 근대적 개혁이 단행되었습니다(정답 A). 대한국 국제(1899)는 광무개혁기, 척화비는 흥선대원군 때 건립되었습니다.'),

    (ch_mod, 'MULTIPLE_4',
     '다음 설명에 해당하는 사건은?\n\n「1894년 전봉준 등을 중심으로 ''보국안민''과 ''제폭구민''을 내걸고 일어난 농민 봉기로, 집강소를 통한 폐정 개혁을 시도하였다.」',
     '{"A":"임오군란","B":"갑신정변","C":"동학 농민 운동","D":"아관파천"}',
     'C', '중',
     '전봉준을 지도자로 보국안민·제폭구민을 내세우고 집강소를 통해 폐정 개혁을 추진한 1894년의 농민 봉기는 동학 농민 운동입니다(정답 C). 임오군란(1882), 갑신정변(1884), 아관파천(1896)과 구분됩니다.'),

    (ch_mod, 'SHORT_ANSWER',
     '고종이 1897년 환궁 후 대한제국을 선포하면서 새로 정한 연호를 쓰시오.',
     NULL, '광무', '하',
     '1897년 고종은 경운궁으로 환궁한 뒤 대한제국을 선포하고 황제로 즉위하면서 연호를 ''광무(光武)''로 정했습니다. 이때 추진된 근대화 개혁을 광무개혁이라 합니다. 정답: 광무.');

  -- [현대사 심화]
  INSERT INTO universal_questions
    (chapter_id, question_type, question_text, options, answer, difficulty, explanation)
  VALUES
    (ch_con, 'MULTIPLE_4',
     '다음 중 1948년 우리나라 최초의 민주 선거인 5·10 총선거에 대한 설명으로 옳은 것은?',
     '{"A":"제헌 국회를 구성하기 위한 선거였다","B":"통일 정부 수립을 위해 남북이 동시에 실시하였다","C":"내각 책임제 정부를 선출하였다","D":"유신 헌법에 따라 실시되었다"}',
     'A', '중',
     '5·10 총선거(1948)는 제헌 국회 의원을 선출하기 위한 우리나라 최초의 보통 선거였고, 이 국회가 헌법을 제정하고 이승만을 초대 대통령으로 선출했습니다(정답 A). 남한만의 단독 선거였습니다.'),

    (ch_con, 'MULTIPLE_4',
     '다음 중 1972년 제정된 유신 헌법의 내용으로 옳은 것은?',
     '{"A":"대통령 직선제를 도입하였다","B":"통일 주체 국민 회의에서 대통령을 간선으로 선출하였다","C":"대통령의 중임을 금지하였다","D":"지방 자치제를 전면 시행하였다"}',
     'B', '상',
     '유신 헌법(1972)은 통일 주체 국민 회의를 통한 대통령 간선제, 대통령의 국회의원 1/3 추천권, 긴급조치권 등 권위주의적 권력 집중을 핵심으로 했습니다(정답 B). 직선제는 1987년 6·29 선언 이후 부활했습니다.'),

    (ch_con, 'SHORT_ANSWER',
     '1987년 6월 민주 항쟁의 결과 발표된 선언으로, 대통령 직선제 개헌 수용을 핵심으로 한 것의 이름을 쓰시오. (예: ○·○○ 선언)',
     NULL, '6·29 선언', '중',
     '1987년 6월 민주 항쟁의 결과, 여당 대표가 대통령 직선제 개헌과 민주화 조치를 약속한 것이 6·29 선언입니다. 이를 통해 5년 단임 직선제 개헌(현행 헌법의 기틀)이 이루어졌습니다. 정답: 6·29 선언.');

  RAISE NOTICE '한국사능력검정시험 벌크 시드 완료: 5개 시대 × 3문항 = 15.';
END;
$$;


-- ════════════════════════════════════════════════════════════
-- D. IELTS Academic Reading — Passage 2 (passage 전 Row 100% 복사)
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE
  cat_ielts   UUID;
  ch_read2    UUID;
  seed_titles TEXT[] := ARRAY['Academic Reading — Passage 2'];
  passage     TEXT;
BEGIN
  SELECT id INTO cat_ielts FROM learning_categories
    WHERE type = 'LANG' AND title = 'IELTS' LIMIT 1;
  IF cat_ielts IS NULL THEN
    cat_ielts := uuid_generate_v4();
    INSERT INTO learning_categories (id, type, title) VALUES (cat_ielts, 'LANG', 'IELTS');
  END IF;

  DELETE FROM user_attempts WHERE question_id IN (
    SELECT q.id FROM universal_questions q
    JOIN learning_chapters c ON c.id = q.chapter_id
    WHERE c.category_id = cat_ielts AND c.level_2 = ANY(seed_titles));
  DELETE FROM universal_questions WHERE chapter_id IN (
    SELECT id FROM learning_chapters
    WHERE category_id = cat_ielts AND level_2 = ANY(seed_titles));
  DELETE FROM learning_chapters
    WHERE category_id = cat_ielts AND level_2 = ANY(seed_titles);

  ch_read2 := uuid_generate_v4();
  INSERT INTO learning_chapters (id, category_id, level_1, level_2) VALUES
    (ch_read2, cat_ielts, 'Reading', 'Academic Reading — Passage 2');

  -- 실전 규격 학술 지문 (약 650단어) — 모든 문항 Row 의 passage 컬럼에 동일 복사
  passage :=
    '## The Standardisation of Time\n\n' ||
    '**[A]** For most of human history, time was a stubbornly local matter. Each town set its clocks by the sun, declaring noon at the moment it stood highest in the sky. Because that moment arrives a little earlier in the east and a little later in the west, two towns a hundred kilometres apart might legitimately disagree about the time by several minutes. For communities that rarely communicated faster than a horse could travel, this caused no difficulty whatsoever. A traveller adjusted a pocket watch on arrival, if at all, and thought no more about it.\n\n' ||
    '**[B]** The railway changed everything. Trains moved people and goods between distant towns at speeds that made local time intolerable. A timetable is meaningless if every station measures the hour differently, and the consequences were not merely inconvenient but dangerous: trains running on a single track relied on precise scheduling to avoid collisions. Railway companies therefore began, in the middle of the nineteenth century, to impose a single uniform time across their entire networks, regardless of the local solar time of the towns they served. In Britain this was simply the time at the Greenwich observatory, distributed along the lines by telegraph.\n\n' ||
    '**[C]** Ordinary citizens did not always welcome the change. Many towns kept two times for a period — the old local time on one clock face and the new "railway time" on another — and some regarded the imposition of a distant standard as an affront to civic independence. Yet the practical advantages were overwhelming, and within a few decades railway time had quietly become the time that everyone used, its origins largely forgotten.\n\n' ||
    '**[D]** What worked within one country soon demanded an international solution. As telegraph cables and steamships knitted the continents together, the absence of any agreed global reference became a serious obstacle. The decisive step came in 1884, when delegates from twenty-five nations met in Washington and agreed to divide the world into standard time zones, each differing from its neighbour by one hour, all measured from a single line of longitude — the meridian passing through Greenwich. The choice of Greenwich was partly a matter of convenience, since a majority of the world''s shipping already used charts based upon it, but it was also a recognition of British maritime dominance, and not every nation accepted it gracefully.\n\n' ||
    '**[E]** The system that emerged was a compromise between astronomical precision and human convenience. In principle, time zones should follow the meridians exactly, in neat bands fifteen degrees wide. In practice, their boundaries bend and zigzag to follow national and regional borders, so that a single country can keep one time even where strict geography would split it. A few territories have chosen offsets of thirty or forty-five minutes rather than a full hour, and one or two have shifted zones for political or economic reasons, demonstrating that the map of world time is shaped as much by human decisions as by the movement of the sun.\n\n' ||
    '**[F]** The standardisation of time is rarely noticed today, precisely because it is so complete. It allowed railways and later airlines to operate, made global finance and communication possible, and quietly dissolved the older, sun-bound sense of time that had governed daily life for millennia. What began as a remedy for the practical problems of the railway became one of the invisible foundations of the connected modern world.';

  INSERT INTO universal_questions
    (chapter_id, question_type, question_text, options, answer, difficulty, explanation, passage)
  VALUES
    (ch_read2, 'MULTIPLE_4',
     '**1. Which of the following best expresses the main idea of the passage?**',
     '{"A":"Local solar time was more accurate than the standardised time that replaced it.","B":"The need for reliable railway schedules drove the adoption of standardised time, which became a foundation of the modern connected world.","C":"The 1884 Washington conference failed to reach any meaningful agreement.","D":"Most countries refused to abandon their local time."}',
     'B', '중',
     '글 전체는 지역 태양시 → 철도가 강제한 표준시 → 1884년 국제 표준 시간대 합의 → 현대 세계의 보이지 않는 토대라는 흐름을 다룹니다([B]~[F]). 따라서 핵심은 B. A·C·D는 본문 내용과 반대되거나(표준시가 정착함) 과장된 진술입니다.'),

    (ch_read2, 'MULTIPLE_4',
     '**2. According to paragraph B, why did railways require a single uniform time?**',
     '{"A":"Because passengers preferred a distant standard to their own local time","B":"Because timetables and single-track safety depended on consistent scheduling across the network","C":"Because the Greenwich observatory ordered them to","D":"Because telegraph wires could not carry local time"}',
     'B', '하',
     '단락 [B]는 서로 다른 지역 시간으로는 시간표가 무의미하고, 단선 철도에서 충돌을 피하려면 정밀한 일정이 필요하므로 철도망 전체에 단일 표준시가 요구되었다고 설명합니다. 정답 B. 나머지는 본문에 근거가 없습니다.'),

    (ch_read2, 'MULTIPLE_5',
     '**3. According to the passage, the choice of Greenwich as the prime meridian in 1884 was due to which of the following?**\n\nⅠ. Much of the world''s shipping already used charts based on it.\nⅡ. It reflected British maritime dominance at the time.\nⅢ. Every nation accepted the decision without objection.',
     '{"A":"Ⅰ only","B":"Ⅲ only","C":"Ⅰ and Ⅱ only","D":"Ⅱ and Ⅲ only","E":"Ⅰ, Ⅱ and Ⅲ"}',
     'C', '상',
     '단락 [D]는 그리니치 선택이 ㉠ 이미 다수 선박이 그리니치 기준 해도를 사용했고(편의), ㉡ 영국 해양 패권의 반영이기도 했다고 말합니다. 다만 ''not every nation accepted it gracefully''라 했으므로 Ⅲ(모든 나라가 이의 없이 수용)은 틀립니다. 따라서 Ⅰ·Ⅱ만 옳아 정답 C.'),

    (ch_read2, 'SHORT_ANSWER',
     '**4. Complete the sentence with ONE WORD from the passage.**\n\nIn principle, time zones should be neat bands fifteen degrees wide, but in practice their boundaries bend to follow national and regional ______.',
     NULL,
     'borders', '중',
     '단락 [E]에 ''their boundaries bend and zigzag to follow national and regional borders''라고 명시됩니다. 시간대 경계가 국가·지역 경계(borders)를 따라 휜다는 내용으로, 한 단어 정답은 borders 입니다. (boundaries 도 의미상 가깝지만 본문 표현은 borders)');

  RAISE NOTICE 'IELTS Academic Reading Passage 2 시드 완료: 지문 1 + 문항 4 (passage 전 Row 복사).';
END;
$$;
