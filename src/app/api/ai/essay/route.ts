import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { gradeSubjective, MOCK_IELTS_FEEDBACK } from '@/lib/ai/subjective';
import type { SubjectiveExamType, SubjectiveFeedback, WeaknessStat } from '@/types';

/* 어학 에세이 첨삭 — OpenAI(gpt-4o-mini) 서버 사이드 창구.
   API 키는 서버(process.env.OPENAI_API_KEY)에서만 사용, 클라이언트 미노출. */
interface Body {
  exam_type:     SubjectiveExamType;
  question_text: string;
  answer:        string;
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
  const examType = body.exam_type ?? 'IELTS';

  // 취약점 연계 컨텍스트
  const { data: weakRaw } = await supabase
    .from('weakness_stats')
    .select('*')
    .eq('user_id', user.id)
    .order('accuracy_rate', { ascending: true })
    .limit(5);
  const weakStats: WeaknessStat[] = weakRaw ?? [];

  // AI 첨삭 (실패 시 고품질 mock 폴백)
  let feedback: SubjectiveFeedback;
  let usedMock = false;
  try {
    feedback = await gradeSubjective(examType, body.question_text, body.answer, weakStats);
  } catch (e) {
    console.warn('[ai/essay] OpenAI 호출 실패 → mock 폴백:', e instanceof Error ? e.message : e);
    feedback = MOCK_IELTS_FEEDBACK;
    usedMock = true;
  }

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
      console.warn('[ai/essay] 결과 저장 실패(비치명적):', e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ feedback, mock: usedMock });
}
