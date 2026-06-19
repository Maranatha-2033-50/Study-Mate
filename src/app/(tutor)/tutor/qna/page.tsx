import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TutorQnaRoom, type TutorInboxQuestion } from '@/components/tutor/TutorQnaRoom';
import type { TutorQuestion } from '@/types';

export const metadata = { title: 'Q&A 수신함 | Study Mate 강사' };

const QCOLS = 'id, student_id, tutor_id, question_id, wrong_context, ai_analysis, status, created_at, updated_at';

export default async function TutorQnaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 나에게 배정된 질문 + 전역 미배정 풀(tutor_id IS NULL)을 동시 조회 (RLS: 011 + 017)
  const [{ data: mineRaw }, { data: poolRaw }] = await Promise.all([
    supabase.from('tutor_questions').select(QCOLS)
      .eq('tutor_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.from('tutor_questions').select(QCOLS)
      .is('tutor_id', null)
      .order('created_at', { ascending: false }),
  ]);

  const mine = (mineRaw ?? []) as TutorQuestion[];
  const pool = (poolRaw ?? []) as TutorQuestion[];

  // 학생 이름 매핑 (양쪽 합집합 1회 조회)
  const studentIds = [...new Set([...mine, ...pool].map((q) => q.student_id))];
  const nameMap = new Map<string, string>();
  if (studentIds.length > 0) {
    const { data: profs } = await supabase.from('profiles').select('id, name').in('id', studentIds);
    for (const p of (profs ?? []) as { id: string; name: string }[]) nameMap.set(p.id, p.name);
  }

  const withName = (q: TutorQuestion): TutorInboxQuestion => ({
    ...q, studentName: nameMap.get(q.student_id) ?? '학생',
  });

  return (
    <TutorQnaRoom
      assigned={mine.map(withName)}
      pool={pool.map(withName)}
      userId={user.id}
    />
  );
}
