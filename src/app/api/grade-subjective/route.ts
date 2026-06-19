import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { gradeSubjective, MOCK_IELTS_FEEDBACK } from '@/lib/ai/subjective';
import { checkAndConsumeToken } from '@/lib/token-guard';
import type { SubjectiveExamType, SubjectiveFeedback, WeaknessStat } from '@/types';

interface Body {
  exam_type:     SubjectiveExamType;
  question_text: string;
  answer:        string;
  user_id?:      string;
  session_id?:   string;
  question_id?:  string;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as Body;
  if (!body.answer?.trim() || !body.question_text?.trim()) {
    return NextResponse.json({ error: 'Missing answer or question_text' }, { status: 400 });
  }

  // [비용 방어 밸브] AI 채점기 작동 직전 토큰 검증·차감 (fail-open 스캐폴딩)
  const guard = await checkAndConsumeToken(supabase, user.id, 2000);
  if (!guard.ok) {
    return NextResponse.json({ error: 'UPGRADE_REQUIRED', reason: guard.reason }, { status: 402 });
  }

  const userId   = body.user_id ?? user.id;
  const examType = body.exam_type ?? 'IELTS';

  // ── 취약점 연계: 채점 전에 학생의 최신 weakness_stats를 컨텍스트로 확보 ──
  const { data: weakRaw } = await supabase
    .from('weakness_stats')
    .select('*')
    .eq('user_id', userId)
    .order('accuracy_rate', { ascending: true })
    .limit(5);
  const weakStats: WeaknessStat[] = weakRaw ?? [];

  // ── AI 채점 (실패 시 고품질 mock으로 안전 폴백) ──
  let feedback: SubjectiveFeedback;
  let usedMock = false;
  try {
    feedback = await gradeSubjective(examType, body.question_text, body.answer, weakStats);
  } catch (e) {
    console.warn('[grade-subjective] AI 호출 실패 → mock 폴백:', e instanceof Error ? e.message : e);
    feedback = MOCK_IELTS_FEEDBACK;
    usedMock = true;
  }

  // ── 결과 저장 (session_id가 있을 때만, 마이그레이션 003 적용 후 동작) ──
  if (body.session_id) {
    try {
      const passThreshold = examType === 'DELF' ? 50 : 6;
      await supabase.from('user_attempts').insert({
        session_id:   body.session_id,
        question_id:  body.question_id ?? null,
        user_answer:  body.answer.slice(0, 8000),
        is_correct:   feedback.overall_score >= passThreshold,
        elapsed_time: 0,
        feedback,
      });
    } catch (e) {
      console.warn('[grade-subjective] 결과 저장 실패 (비치명적):', e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ feedback, mock: usedMock });
}
