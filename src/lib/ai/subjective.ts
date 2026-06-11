import type {
  SubjectiveExamType,
  SubjectiveFeedback,
  WeaknessStat,
} from '@/types';

const AI_BASE_URL = process.env.AI_BASE_URL ?? 'https://api.openai.com/v1';
const AI_MODEL    = process.env.AI_MODEL    ?? 'gpt-4o-mini';
const AI_API_KEY  = process.env.AI_API_KEY  ?? '';

// ── 공식 채점 루브릭 (시스템 프롬프트에 주입) ─────────────────────────────────
const RUBRICS: Record<SubjectiveExamType, string> = {
  IELTS: `You are an official IELTS examiner. Grade the candidate's Writing/Speaking response
strictly according to the four official IELTS band descriptors (band 0–9, allow .5 increments):
- "Task Response" (Writing) / "Fluency and Coherence" (Speaking)
- "Coherence and Cohesion" (Writing) / "Lexical Resource" (Speaking)
- "Lexical Resource"
- "Grammatical Range and Accuracy"
overall_score is the rounded average band (nearest 0.5). Criteria keys must be the descriptor names above.`,

  DELF: `Vous êtes un correcteur officiel DELF/DALF. Évaluez la production écrite/orale du candidat
selon la grille officielle DELF (note 0–25 par critère):
- "Respect de la consigne"
- "Cohérence et cohésion"
- "Compétence lexicale / orthographe"
- "Compétence grammaticale"
overall_score est la note totale sur 100 (somme des critères). Les clés de "criteria" doivent être les noms ci-dessus.`,
};

function buildSystemPrompt(examType: SubjectiveExamType): string {
  return `${RUBRICS[examType]}

You will receive the student's recent weak-point statistics. Use them to personalize the feedback:
connect the mistakes in this answer to the student's recurring weak chapters.

Respond with a SINGLE JSON object only (no markdown, no prose) in EXACTLY this schema:
{
  "overall_score": number,
  "criteria": { "<criterion name>": { "score": number, "comment": "one-line evaluation (Korean)" } },
  "corrections": [ { "original": "verbatim wrong sentence", "corrected": "fixed sentence", "rationale": "교정 이유 (Korean)" } ],
  "general_feedback": "학생용 실전 오답노트 총평 (Korean, 3~5문장, 격려 포함)",
  "tutor_guide": "강사용 AI 코칭 백서 (Korean Markdown). 학생의 weakness_stats 취약 단원과 이번 답변의 실수를 연계 분석하여, 대면 코칭 시 집중 지도 포인트를 ## 제목과 - 불릿으로 구조화"
}
All commentary fields (comment, rationale, general_feedback, tutor_guide) MUST be written in Korean.`;
}

function buildUserPrompt(
  examType: SubjectiveExamType,
  questionText: string,
  answer: string,
  weakStats: WeaknessStat[],
): string {
  const weakLines = weakStats.length
    ? weakStats
        .slice(0, 5)
        .map(
          (w, i) =>
            `${i + 1}. [${w.level_1}] ${w.level_2} — 정답률 ${w.accuracy_rate}% (${w.total_attempts}문항)`,
        )
        .join('\n')
    : '(아직 누적된 취약점 데이터 없음)';

  return `## 시험 종류
${examType}

## 문항 (Prompt)
${questionText}

## 학생 답안 (Student Response)
${answer}

## 학생의 최근 취약 단원 (weakness_stats Top-5)
${weakLines}

위 채점 루브릭과 학생의 취약 단원을 종합하여 JSON으로만 채점·첨삭 결과를 반환하세요.`;
}

// ── 고품질 IELTS mock — API 키 비활성/실패 시 안전 폴백 ───────────────────────
export const MOCK_IELTS_FEEDBACK: SubjectiveFeedback = {
  overall_score: 6.5,
  criteria: {
    'Task Response':                 { score: 6.5, comment: '입장은 명확하나 일부 논점의 근거 전개가 표면적입니다.' },
    'Coherence and Cohesion':        { score: 7.0, comment: '문단 구조와 연결어 사용이 안정적입니다.' },
    'Lexical Resource':              { score: 6.0, comment: '어휘 다양성은 충분하나 collocation 오류가 반복됩니다.' },
    'Grammatical Range and Accuracy':{ score: 6.0, comment: '복문 시도는 좋으나 관사·시제 오류가 점수를 제약합니다.' },
  },
  corrections: [
    {
      original:  'Nowadays, many people thinks that technology have changed our life in many ways.',
      corrected: 'Nowadays, many people think that technology has changed our lives in many ways.',
      rationale: '주어 "people"은 복수이므로 "think", "technology"는 단수라 "has"가 맞습니다. "lives"로 복수 처리하세요. (주술 일치 — 반복되는 취약점)',
    },
    {
      original:  'In conclusion, I am agree that the advantages is more than disadvantages.',
      corrected: 'In conclusion, I agree that the advantages outweigh the disadvantages.',
      rationale: '"agree"는 동사라 "am"이 불필요합니다. "advantages"는 복수이므로 "outweigh", 비교 표현은 "outweigh"가 자연스럽습니다.',
    },
    {
      original:  'This problem can be solved by goverment make new policies.',
      corrected: 'This problem can be solved if the government introduces new policies.',
      rationale: '"goverment" 철자 오류(government), "make"는 절 구조로 바꿔야 문법적으로 정확합니다. 조건절 if를 활용하세요.',
    },
  ],
  general_feedback:
    '전반적으로 글의 구조와 입장 전달은 Band 6.5 수준으로 안정적입니다. 다만 주술 일치와 관사·시제 오류가 반복되어 Grammatical Accuracy 점수를 끌어내리고 있어요. 결론부의 collocation(outweigh 등)을 정확히 익히면 7.0 진입이 충분히 가능합니다. 오늘 첨삭한 3개 문장 패턴을 오답노트에 정리하고 유사 문장을 5개씩 다시 써보세요. 꾸준함이 밴드를 올립니다!',
  tutor_guide:
    '## AI 코칭 백서 — Writing 집중 지도 포인트\n\n' +
    '이 학생은 **Grammatical Range and Accuracy(6.0)**가 전체 밴드를 제약하는 핵심 병목입니다.\n\n' +
    '### 누적 취약점과의 연계\n' +
    '- weakness_stats 상 **Reading > True/False/Not Given** 정답률이 낮은 점과, 이번 답안의 *논리 근거 전개 부족(Task Response)*이 연결됩니다 — 텍스트의 함의를 정밀하게 다루는 훈련이 양쪽에 모두 필요합니다.\n' +
    '- 주술 일치 오류가 객관식 문법 단원에서도 반복 관찰됩니다.\n\n' +
    '### 대면 코칭 시 집중 지도\n' +
    '1. **주술 일치·관사·시제** — 3대 반복 오류. 화이트보드에서 학생이 직접 오류를 찾아 고치게 하는 self-correction 드릴 권장.\n' +
    '2. **Collocation 노트** — outweigh, address an issue 등 에세이 빈출 표현 20개를 함께 정리.\n' +
    '3. **결론부 템플릿** — 입장 재진술 + 근거 요약 구조를 고정 템플릿으로 체화.\n\n' +
    '> 다음 세션 목표: 동일 프롬프트 재작성으로 Grammatical Accuracy 6.0 → 6.5 견인.',
};

// ── 메인 채점 함수 (실패 시 throw → 라우트에서 mock 폴백) ─────────────────────
export async function gradeSubjective(
  examType: SubjectiveExamType,
  questionText: string,
  answer: string,
  weakStats: WeaknessStat[],
): Promise<SubjectiveFeedback> {
  if (!AI_API_KEY) throw new Error('AI_API_KEY is not configured');

  const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildSystemPrompt(examType) },
        { role: 'user',   content: buildUserPrompt(examType, questionText, answer, weakStats) },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const raw: string = data.choices[0].message.content.trim();
  return JSON.parse(raw) as SubjectiveFeedback;
}
