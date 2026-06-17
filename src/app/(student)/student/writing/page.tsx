import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EssayTestRoom } from '@/components/student/EssayTestRoom';
import type { UniversalQuestion, SubjectiveExamType } from '@/types';

export const metadata = { title: 'Writing 시험방 | Study Mate' };

export default async function WritingPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; question?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { category, question } = await searchParams;
  if (!question) redirect('/student/lang');

  const { data: q } = await supabase
    .from('universal_questions')
    .select('*')
    .eq('id', question)
    .single();

  if (!q) redirect(category ? `/student/lang?category=${category}` : '/student/lang');

  const categoryId = category ?? '';
  let examType: SubjectiveExamType = 'IELTS';
  if (categoryId) {
    const { data: cat } = await supabase
      .from('learning_categories')
      .select('title')
      .eq('id', categoryId)
      .single();
    if (cat?.title?.toUpperCase().includes('DELF')) examType = 'DELF';
  }

  return (
    <EssayTestRoom
      question={q as UniversalQuestion}
      categoryId={categoryId}
      examType={examType}
    />
  );
}
