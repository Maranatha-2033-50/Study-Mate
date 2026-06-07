import type { AIStudyPlan, PlannerInput } from '@/types';

const AI_BASE_URL = process.env.AI_BASE_URL ?? 'https://api.openai.com/v1';
const AI_MODEL    = process.env.AI_MODEL    ?? 'gpt-4o-mini';
const AI_API_KEY  = process.env.AI_API_KEY  ?? '';

function buildUserPrompt(input: PlannerInput): string {
  const daysUntilExam = Math.max(
    1,
    Math.ceil(
      (new Date(input.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
  );

  const weakList = input.weak_chapters
    .slice(0, 5)
    .map(
      (w, i) =>
        `${i + 1}. [${w.level_1}] ${w.level_2} — 정답률 ${w.accuracy_rate}%`
    )
    .join('\n');

  return `
## 학생 데이터
- 시험/과목: ${input.category_title}
- 시험까지 남은 일수: ${daysUntilExam}일 (목표일: ${input.exam_date})
- 하루 가용 공부 시간: ${input.available_hours}시간

## 취약 단원 Top-${input.weak_chapters.slice(0, 5).length}
${weakList}

위 데이터를 기반으로 향후 7일간의 '약점 격파 루틴 테이블'을 JSON으로 생성하세요.
응답은 반드시 다음 JSON 스키마를 따르세요:
{
  "summary": "전략 요약 (2~3문장)",
  "weekly_goal": "이번 주 핵심 목표",
  "daily_plans": [
    {
      "date": "YYYY-MM-DD",
      "sessions": [
        {
          "time_slot": "예: 오전 09:00",
          "chapter": "단원명",
          "task": "구체적 학습 과제",
          "duration_min": 분(숫자)
        }
      ]
    }
  ],
  "tips": ["추가 학습 팁 3가지"]
}
JSON만 반환하고, 다른 텍스트는 포함하지 마세요.
`.trim();
}

export async function generateStudyPlan(input: PlannerInput): Promise<AIStudyPlan> {
  const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: 'system',
          content:
            '당신은 대입 교과 과외 및 자격증/어학 전문 전략가입니다. 학생의 현재 취약 영역 통계와 목표 시험 정보, 하루 가용 시간을 분석하여 실현 가능하고 정교한 "약점 격파 루틴 테이블"을 일자별/교시별로 상세히 수립하세요.',
        },
        { role: 'user', content: buildUserPrompt(input) },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const raw: string = data.choices[0].message.content.trim();

  // Strip markdown code fence if present
  const jsonText = raw.startsWith('```')
    ? raw.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim()
    : raw;

  return JSON.parse(jsonText) as AIStudyPlan;
}
