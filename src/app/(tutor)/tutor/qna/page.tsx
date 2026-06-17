import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TutorQnaRoom, type TutorInboxQuestion } from '@/components/tutor/TutorQnaRoom';
import type { TutorQuestion } from '@/types';

export const metadata = { title: 'Q&A 수신함 | Study Mate 강사' };

export default async function TutorQnaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 나에게 배정된 학생 질문 (RLS: tutor_id = auth.uid())
  const { data: rows } = await supabase
    .from('tutor_questions')
    .select('id, student_id, tutor_id, question_id, wrong_context, ai_analysis, status, created_at, updated_at')
    .eq('tutor_id', user.id)
    .order('created_at', { ascending: false });

  const questions = (rows ?? []) as TutorQuestion[];

  // 학생 이름 매핑
  const studentIds = [...new Set(questions.map((q) => q.student_id))];
  const nameMap = new Map<string, string>();
  if (studentIds.length > 0) {
    const { data: profs } = await supabase.from('profiles').select('id, name').in('id', studentIds);
    for (const p of (profs ?? []) as { id: string; name: string }[]) nameMap.set(p.id, p.name);
  }

  const withNames: TutorInboxQuestion[] = questions.map((q) => ({
    ...q,
    studentName: nameMap.get(q.student_id) ?? '학생',
  }));

  return <TutorQnaRoom questions={withNames} userId={user.id} />;
}
