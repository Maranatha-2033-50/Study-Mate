import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callSolar } from '@/lib/ai/clients';
import { checkAndConsumeToken } from '@/lib/token-guard';
import type { WrongContext } from '@/types';

/* 자격증·국내외 교과 오답 맹점 분석 — Upstage Solar(한국어 최적화) 서버 사이드 창구.
   API 키는 서버(process.env.SOLAR_API_KEY)에서만 사용, 클라이언트 미노출. */

const SYSTEM = `당신은 한국 교육과정과 자격증 시험에 정통한 1:1 전문 튜터입니다.
학생이 틀린 문제의 컨텍스트를 받아, 왜 틀렸는지(개념적 맹점)와 무엇을 보완해야 하는지를
정밀하게 진단합니다. 반드시 한국어로, 다음 마크다운 구조로만 작성하세요:
## 핵심 맹점
- (학생이 놓친 개념을 1~2줄)
## 오답 원인 분석
- (학생이 고른 오답이 왜 매력적인 오답이었는지, 정답과의 결정적 차이)
## 보완 학습 처방
- (구체적 복습 포인트 2~3개, 실천 가능한 형태)
간결하고 핵심적으로, 군더더기 없이.`;

function buildPrompt(c: WrongContext): string {
  const opts = c.options
    ? Object.entries(c.options).map(([k, v]) => `  ${k}. ${v}`).join('\n')
    : '(주관식 — 보기 없음)';
  return `## 과목/단원
${c.category_title} · ${c.level_1} › ${c.level_2} · 난이도 ${c.difficulty}

## 문제
${c.question_text}

## 보기
${opts}

## 학생이 고른 오답
${c.user_wrong_answer || '(미응답)'}

## 정답
${c.correct_answer}

위 정보를 바탕으로 학생의 맹점을 진단해 주세요.`;
}

function mockReport(c: WrongContext): string {
  return `## 핵심 맹점
- **${c.level_2}** 단원의 핵심 개념 적용에서 정답(${c.correct_answer})과 선택지(${c.user_wrong_answer || '미응답'})를 변별하지 못했습니다.

## 오답 원인 분석
- 표면적으로 그럴듯한 선택지에 이끌려 정답의 결정적 조건을 놓쳤을 가능성이 높습니다.

## 보완 학습 처방
- ${c.level_1} 영역의 기본 정의를 다시 정리하고, 유사 유형 3문항을 풀며 정답 근거를 말로 설명해 보세요.
- 오답 보관함에서 1·3·7일 간격으로 재응시해 장기 기억으로 굳히세요.`;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ctx = (await req.json()) as Partial<WrongContext>;
  if (!ctx?.question_text) {
    return NextResponse.json({ error: 'Missing wrong context' }, { status: 400 });
  }

  // [비용 방어 밸브] AI 맹점 분석(LLM) 직전 토큰 검증·차감 (fail-open 스캐폴딩)
  const guard = await checkAndConsumeToken(supabase, user.id, 1024);
  if (!guard.ok) {
    return NextResponse.json({ error: 'UPGRADE_REQUIRED', reason: guard.reason }, { status: 402 });
  }
  const full: WrongContext = {
    question_text:     ctx.question_text,
    options:           ctx.options ?? null,
    correct_answer:    ctx.correct_answer ?? '',
    user_wrong_answer: ctx.user_wrong_answer ?? '',
    level_1:           ctx.level_1 ?? '',
    level_2:           ctx.level_2 ?? '',
    category_title:    ctx.category_title ?? '',
    difficulty:        ctx.difficulty ?? '',
  };

  let report: string;
  let usedMock = false;
  try {
    report = await callSolar({ system: SYSTEM, user: buildPrompt(full), maxTokens: 1024 });
    if (!report) throw new Error('empty response');
  } catch (e) {
    console.warn('[ai/analyze] Solar 호출 실패 → mock 폴백:', e instanceof Error ? e.message : e);
    report = mockReport(full);
    usedMock = true;
  }

  return NextResponse.json({ report, mock: usedMock });
}
