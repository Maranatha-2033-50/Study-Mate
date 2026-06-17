import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PlannerStudio } from '@/components/student/PlannerStudio';
import { StudentShell } from '@/components/layout/StudentChrome';
import { Brain } from 'lucide-react';
import type { WeaknessStat, LearningCategory, AIStudyPlanRow } from '@/types';

export const metadata = { title: 'AI 정밀 플래너 | Study Mate' };

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const params = await searchParams;

  const { data: categories } = await supabase
    .from('learning_categories')
    .select('*')
    .order('title');

  const allCategories: LearningCategory[] = categories ?? [];
  const activeCategoryId = params.category ?? allCategories[0]?.id ?? '';
  const activeCategory   = allCategories.find((c) => c.id === activeCategoryId);

  const [{ data: statsRaw }, { data: planRaw }] = await Promise.all([
    supabase
      .from('weakness_stats')
      .select('*')
      .eq('user_id', user.id)
      .eq('category_id', activeCategoryId)
      .order('accuracy_rate', { ascending: true }),
    supabase
      .from('ai_study_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('category_id', activeCategoryId)
      .maybeSingle(),
  ]);

  return (
    <StudentShell>
      <div className="max-w-3xl mx-auto px-2 sm:px-0 py-2 space-y-6">
        {/* 헤더 */}
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-1">
            <Brain size={13} /> AI Precision Planner
          </p>
          <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">AI 정밀 플래너</h1>
          <p className="text-sm text-slate-400 mt-1">
            시험 날짜와 요일별 가용 시간을 설정하면, AI가 확보 가능한 시간 예산에 맞춰 약점 극복 로드맵을 설계합니다.
          </p>
        </div>

        {activeCategory ? (
          <PlannerStudio
            categoryId={activeCategoryId}
            categoryTitle={activeCategory.title}
            weakStats={(statsRaw as WeaknessStat[]) ?? []}
            initialPlan={(planRaw as AIStudyPlanRow | null) ?? null}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center text-slate-400">
            학습 카테고리가 없습니다. 먼저 진단 평가를 진행해 주세요.
          </div>
        )}
      </div>
    </StudentShell>
  );
}
