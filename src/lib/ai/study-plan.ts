import type { InteractivePlan, PlanMilestone, WeaknessStat } from '@/types';

const AI_BASE_URL = process.env.AI_BASE_URL ?? 'https://api.openai.com/v1';
const AI_MODEL    = process.env.AI_MODEL    ?? 'gpt-4o-mini';
const AI_API_KEY  = process.env.AI_API_KEY  ?? '';

export interface PlanGenInput {
  categoryTitle: string;
  examDate:      string;   // YYYY-MM-DD
  dDay:          number;   // 남은 일수
  budgetHours:   number;   // 총 학습 가용 시간 (Study Budget)
  weeklyBreakdown: string; // 요일별 가용시간 요약 문자열
  weakStats:     WeaknessStat[];
}

function weakLines(weakStats: WeaknessStat[]): string {
  return weakStats.length
    ? weakStats
        .slice(0, 6)
        .map((w, i) => `${i + 1}. [${w.level_1}] ${w.level_2} — 정답률 ${w.accuracy_rate}% (${w.total_attempts}문항)`)
        .join('\n')
    : '(아직 누적된 취약점 데이터 없음 — 진단 평가 권장)';
}

const SYSTEM_PROMPT = `당신은 자격증·어학·교과 시험 전문 학습 전략가입니다.
학생이 시험일까지 실제로 확보할 수 있는 '총 학습 가용 시간(Study Budget)'과 취약 단원 통계를 받아,
그 시간 예산 안에서 약점을 극복하도록 마일스톤 중심의 전략 로드맵을 설계합니다.
핵심 원칙:
- 배정 시간(hours)의 총합이 주어진 Study Budget을 초과하지 않게 하세요.
- 가장 취약한 단원에 더 많은 시간을 배분하세요.
- 마일스톤은 5~8개, 시험일에 가까울수록 실전/복습 비중을 높이세요.
- day_range는 'D-30 ~ D-21'처럼 표기하고 시험일까지의 흐름을 반영하세요.

반드시 아래 JSON 스키마의 단일 객체로만 응답하세요(마크다운/설명 금지):
{
  "summary": "전략 요약 2~3문장 (한국어)",
  "encouragement": "학생을 위한 따뜻한 격려 메시지 1~2문장 (한국어)",
  "milestones": [
    { "title": "마일스톤 제목", "detail": "구체적 학습 과제 (한국어 마크다운, - 불릿 활용)", "day_range": "D-30 ~ D-21", "hours": 12 }
  ]
}
모든 텍스트는 한국어로 작성하세요.`;

function buildUserPrompt(input: PlanGenInput): string {
  return `## 학생 데이터
- 시험/과목: ${input.categoryTitle}
- 목표 시험일: ${input.examDate} (D-${input.dDay})
- 총 학습 가용 시간(Study Budget): ${input.budgetHours}시간
- 요일별 가용 시간: ${input.weeklyBreakdown}

## 취약 단원 (weakness_stats)
${weakLines(input.weakStats)}

위 Study Budget(${input.budgetHours}시간) 안에서 약점을 극복할 마일스톤 로드맵을 JSON으로만 생성하세요.`;
}

// 마일스톤에 안정적 id(m1, m2 …) 부여
function withIds(milestones: Omit<PlanMilestone, 'id'>[]): PlanMilestone[] {
  return milestones.map((m, i) => ({ id: `m${i + 1}`, ...m }));
}

// ── 고품질 mock — API 키 부재/실패 시 안전 폴백 (취약점·예산 반영해 동적 생성) ──
export function mockPlan(input: PlanGenInput): InteractivePlan {
  const weak = input.weakStats.slice(0, 4);
  const names = weak.length
    ? weak.map((w) => `${w.level_2}(${w.accuracy_rate}%)`)
    : ['핵심 개념', '기출 유형', '실전 문제', '오답 복습'];
  const budget = input.budgetHours || 20;
  const perStage = Math.max(1, Math.round((budget * 0.8) / 4));

  const ms: Omit<PlanMilestone, 'id'>[] = [
    {
      title: '진단·기초 다지기',
      detail: `가장 취약한 **${names[0] ?? '핵심 단원'}** 부터 개념을 다시 정리합니다.\n- 핵심 이론 노트 정리\n- 쉬운 난이도 문항으로 감 잡기`,
      day_range: `D-${input.dDay} ~ D-${Math.max(0, input.dDay - Math.ceil(input.dDay / 4))}`,
      hours: perStage,
    },
    {
      title: '취약 단원 집중 격파',
      detail: `${names.slice(0, 2).join(', ')} 집중 훈련.\n- 무한 훈련방으로 단원별 20문항 이상\n- 틀린 문항은 오답노트 보관함에서 즉시 복습`,
      hours: perStage,
      day_range: `D-${Math.max(0, input.dDay - Math.ceil(input.dDay / 4))} ~ D-${Math.max(0, input.dDay - Math.ceil(input.dDay / 2))}`,
    },
    {
      title: '실전 모의고사 적용',
      detail: `실전 모의고사로 시간 관리와 약점 재점검.\n- 회당 1세트 풀이 후 오답 분석\n- 정답률 60% 미만 단원 재훈련`,
      hours: perStage,
      day_range: `D-${Math.max(0, input.dDay - Math.ceil(input.dDay / 2))} ~ D-${Math.max(0, Math.ceil(input.dDay / 4))}`,
    },
    {
      title: '마무리 총정리 & 컨디션',
      detail: `오답노트 전체 재훈련 + 시험 전날 컨디션 관리.\n- 누적 오답 0 만들기\n- 시험 당일 루틴 점검`,
      hours: Math.max(1, budget - perStage * 3),
      day_range: `D-${Math.max(0, Math.ceil(input.dDay / 4))} ~ D-0`,
    },
  ];

  return {
    summary: `${input.categoryTitle} 시험까지 ${input.dDay}일, 총 ${budget}시간을 확보했습니다. 가장 취약한 ${names[0] ?? '단원'}을(를) 우선 공략하고, 후반부에 실전·복습 비중을 높이는 4단계 로드맵입니다.`,
    encouragement: '확보한 시간을 믿고 한 단계씩 채워가면 합격권은 충분히 닿습니다. 오늘의 한 문제가 내일의 점수입니다! 💪',
    milestones: withIds(ms),
  };
}

// ── 메인 생성 함수 (실패 시 throw → 라우트에서 mock 폴백) ─────────────────────
export async function generateInteractivePlan(input: PlanGenInput): Promise<InteractivePlan> {
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
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: buildUserPrompt(input) },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const raw: string = data.choices[0].message.content.trim();
  const parsed = JSON.parse(raw) as Partial<InteractivePlan> & { milestones?: Omit<PlanMilestone, 'id'>[] };

  return {
    summary:       parsed.summary ?? '',
    encouragement: parsed.encouragement ?? '',
    milestones:    withIds((parsed.milestones ?? []).slice(0, 8)),
  };
}
