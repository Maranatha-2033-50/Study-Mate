import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/* 진단/모의고사 블라인드 채점 라우트.
   클라이언트는 정답(answer)·해설(explanation)을 받지 않은 상태로 응시하고, 제출 시 답안만 보낸다.
   서버가 DB에서 정답을 권위 조회해 채점한 뒤 점수 + 문항별 리뷰 + 단원별 취약점 리포트를 반환한다.
   정답/해설은 제출 이후의 리뷰 응답에서만 노출된다. */

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

  // 세션 소유권 검증
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

  // 서버 권위 채점: 정답/해설/단원 정보는 서버에서만 조회한다(클라이언트로 절대 미전송).
  const questionIds = attempts.map((a) => a.question_id);
  const { data: questions } = await supabase
    .from('universal_questions')
    .select('id, answer, explanation, chapter_id, learning_chapters(level_1, level_2)')
    .in('id', questionIds);

  const qMap = new Map((questions ?? []).map((q) => [q.id, q]));

  const rows = attempts.map((a) => {
    const correct = (qMap.get(a.question_id)?.answer ?? '').trim().toUpperCase();
    return {
      session_id,
      question_id:  a.question_id,
      user_answer:  a.user_answer.trim(),
      is_correct:   correct !== '' && a.user_answer.trim().toUpperCase() === correct,
      elapsed_time: Math.max(0, Math.min(a.elapsed_time, 3600)),
    };
  });

  await supabase.from('user_attempts').insert(rows);
  await supabase.from('study_sessions').update({ status: 'COMPLETED' }).eq('id', session_id);

  const correctCount = rows.filter((r) => r.is_correct).length;

  // 제출 후에만 정답/해설 공개 (오답노트 리뷰용)
  const review = rows.map((r) => {
    const q = qMap.get(r.question_id);
    return {
      question_id:    r.question_id,
      user_answer:    r.user_answer,
      is_correct:     r.is_correct,
      correct_answer: q?.answer ?? '',
      explanation:    q?.explanation ?? null,
    };
  });

  // 단원별 취약점 리포트 (정답률 오름차순)
  const byChapter = new Map<string, { level_1: string; level_2: string; total: number; correct: number }>();
  for (const r of rows) {
    const q = qMap.get(r.question_id);
    if (!q) continue;
    const ch = Array.isArray(q.learning_chapters) ? q.learning_chapters[0] : q.learning_chapters;
    const key = q.chapter_id as string;
    const cur = byChapter.get(key) ?? { level_1: ch?.level_1 ?? '', level_2: ch?.level_2 ?? '', total: 0, correct: 0 };
    cur.total += 1;
    if (r.is_correct) cur.correct += 1;
    byChapter.set(key, cur);
  }
  const weakness = [...byChapter.entries()]
    .map(([chapter_id, v]) => ({
      chapter_id,
      level_1:  v.level_1,
      level_2:  v.level_2,
      total:    v.total,
      correct:  v.correct,
      accuracy: v.total === 0 ? 0 : Math.round((v.correct / v.total) * 100),
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  return NextResponse.json({
    correct_count: correctCount,
    total:         rows.length,
    accuracy_rate: rows.length === 0 ? 0 : Math.round((correctCount / rows.length) * 100),
    review,
    weakness,
  });
}
