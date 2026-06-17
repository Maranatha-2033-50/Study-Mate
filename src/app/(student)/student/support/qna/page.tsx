import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StudentShell } from '@/components/layout/StudentChrome';
import { QnaRoom } from '@/components/student/QnaRoom';
import type { TutorQuestion } from '@/types';

export const metadata = { title: '선생님 문의방 | Study Mate' };

export default async function QnaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 내가 연 질문 스레드 (RLS: student_id = auth.uid())
  const { data: rows } = await supabase
    .from('tutor_questions')
    .select('id, student_id, tutor_id, question_id, wrong_context, ai_analysis, status, created_at, updated_at')
    .eq('student_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <StudentShell>
      <QnaRoom questions={(rows ?? []) as TutorQuestion[]} userId={user.id} />
    </StudentShell>
  );
}
