import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WeaknessPlanner } from '@/components/student/WeaknessPlanner';
import type { WeaknessStat } from '@/types';

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const params     = await searchParams;
  const categoryId = params.category ?? '';

  const [{ data: categoryRaw }, { data: statsRaw }] = await Promise.all([
    supabase.from('learning_categories').select('title').eq('id', categoryId).single(),
    supabase
      .from('weakness_stats')
      .select('*')
      .eq('user_id', user.id)
      .eq('category_id', categoryId)
      .order('accuracy_rate', { ascending: true }),
  ]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">AI 맞춤형 학습 플래너</h1>
        <p className="text-sm text-gray-500 mt-1">
          취약 단원과 목표 시험일을 기반으로 AI가 최적의 학습 루틴을 수립합니다.
        </p>
      </div>
      <WeaknessPlanner
        categoryTitle={categoryRaw?.title ?? ''}
        weakStats={(statsRaw as WeaknessStat[]) ?? []}
      />
    </div>
  );
}
