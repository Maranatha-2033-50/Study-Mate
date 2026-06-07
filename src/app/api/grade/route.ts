import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface AttemptInput {
  question_id:  string;
  user_answer:  string;
  elapsed_time: number;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { session_id, attempts }: { session_id: string; attempts: AttemptInput[] } =
    await req.json();

  if (!session_id || !Array.isArray(attempts)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // Verify session ownership
  const { data: session } = await supabase
    .from('study_sessions')
    .select('user_id, status')
    .eq('id', session_id)
    .single();

  if (!session || session.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (session.status === 'COMPLETED') {
    return NextResponse.json({ error: 'Already completed' }, { status: 409 });
  }

  // Authoritative grading
  const questionIds = attempts.map((a) => a.question_id);
  const { data: questions } = await supabase
    .from('universal_questions')
    .select('id, answer')
    .in('id', questionIds);

  const answerMap = Object.fromEntries(
    (questions ?? []).map((q) => [q.id, q.answer.trim().toUpperCase()])
  );

  const rows = attempts.map((a) => ({
    session_id,
    question_id:  a.question_id,
    user_answer:  a.user_answer.trim(),
    is_correct:   a.user_answer.trim().toUpperCase() === (answerMap[a.question_id] ?? ''),
    elapsed_time: Math.max(0, Math.min(a.elapsed_time, 3600)),
  }));

  await supabase.from('user_attempts').insert(rows);
  await supabase.from('study_sessions').update({ status: 'COMPLETED' }).eq('id', session_id);

  const correctCount = rows.filter((r) => r.is_correct).length;

  return NextResponse.json({
    correct_count:  correctCount,
    total:          rows.length,
    accuracy_rate:  rows.length === 0 ? 0 : Math.round((correctCount / rows.length) * 100),
  });
}
