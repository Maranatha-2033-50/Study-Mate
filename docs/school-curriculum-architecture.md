# 교과(SCHOOL) 다국적·다차원 커리큘럼 확장 아키텍처

> 향후 SCHOOL 도메인이 한국 수능/내신, 캐나다 교육과정, 영국 A-Level/GCSE 등으로
> 정교하게 스케일업될 때 **단원 코드 충돌 없이** 안전하게 확장하기 위한 설계 규약.
> 베이스 컬럼은 마이그레이션 `006_cert_lang_bulk_seed.sql` 0번 섹션에서 도입됨.

## 1. 현재 데이터 구조 (불변)

```
learning_categories (id, type['CERT'|'LANG'|'SCHOOL'], title)
   └─ learning_chapters (id, category_id, level_1, level_2, curriculum_code?)
        └─ universal_questions (id, chapter_id, question_type, question_text,
                                options, answer, difficulty, explanation, passage)
```

- `level_1` / `level_2`는 **사람이 읽는 표시용 분류**(대분류/중분류)로 계속 사용한다.
- 앱의 모든 조회 쿼리는 `category_id` + `level_1` + `level_2`만 사용하므로,
  아래 확장 컬럼은 **100% 하위 호환**(추가해도 기존 동작 무영향)이다.

## 2. 확장 훅: `learning_chapters.curriculum_code` (nullable TEXT)

다국적 커리큘럼을 한 트리에 안전하게 수용하기 위한 **선택적 분류 코드**. NULL 허용.

### 접두어 규약 — `국가_과정_과목_세부`

| 코드 예시 | 의미 |
|---|---|
| `KR_SAT_MATH_CALC` | 한국 수능 수학 · 미적분 |
| `KR_HIGH1_ENG_READ` | 한국 고1 영어 · 독해(내신) |
| `KR_MIDDLE3_SCI` | 한국 중3 과학 |
| `CA_ON_MCV4U` | 캐나다 온타리오 · Calculus & Vectors |
| `CA_BC_MATH10` | 캐나다 BC주 · Math 10 |
| `UK_ALEVEL_FMATH` | 영국 A-Level · Further Mathematics |
| `UK_ALEVEL_ECON` | 영국 A-Level · Economics |
| `UK_GCSE_BUSINESS` | 영국 GCSE · Business |

규칙:
1. 첫 토큰은 **국가 코드**(`KR` / `CA` / `UK` …).
2. 두 번째 토큰은 **과정/시험 체계**(`SAT`, `HIGH1`, `ON`, `ALEVEL`, `GCSE` …).
3. 이후 토큰은 **과목·세부**로 자유 확장. 토큰 구분자는 `_`.
4. 접두어는 충돌하지 않는 한 자유롭게 신설 가능. `level_1/level_2`(표시명)와 독립.

### 인덱스

```sql
CREATE INDEX idx_chapters_curriculum_code
  ON learning_chapters(curriculum_code) WHERE curriculum_code IS NOT NULL;
```

→ `WHERE curriculum_code LIKE 'UK_ALEVEL_%'` 같은 과정별 필터가 효율적.

## 3. 향후 확장 경로 (무중단)

- **단일 코드로 부족할 때(M:N 태깅)**: 한 단원이 여러 분류(예: 수능+내신 공용)에
  속해야 하면, `curriculum_code`는 그대로 둔 채 별도 `chapter_tags(chapter_id, tag)`
  조인 테이블을 신설한다. 현재 컬럼이 1차 단일 코드 훅 역할을 하므로
  마이그레이션이 가산적(additive)이며 기존 데이터/쿼리를 깨지 않는다.
- **학년·학기 메타가 필요할 때**: `learning_chapters`에 `grade SMALLINT`,
  `term SMALLINT` 등 nullable 컬럼을 `ADD COLUMN IF NOT EXISTS`로 가산.
- **국가별 카테고리 분리가 필요할 때**: `learning_categories.title`에
  국가 접두(예: `[UK] A-Level Economics`)를 붙이거나, 위 코드 체계로 단원 단위 구분.

## 4. 시드 멱등성 규약 (필수 준수)

모든 시드 마이그레이션은 **도입하는 신규 `level_2` 라벨 집합**으로만 스코프하여
`user_attempts → universal_questions → learning_chapters` 순으로 정리 후 재적재한다
(004/006 패턴). 이로써 중복 실행해도 데이터가 깨지지 않고 콘텐츠만 최신으로 갱신되며,
다른 마이그레이션의 시드(다른 라벨)는 절대 건드리지 않는다.
