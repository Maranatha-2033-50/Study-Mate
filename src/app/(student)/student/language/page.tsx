import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LanguageDashboard } from '@/components/student/LanguageDashboard';
import type { WeaknessStat, LearningCategory } from '@/types';

export const metadata = { title: '언어 학습 대시보드 | Study Mate' };

export default async function LanguagePage({
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
    .eq('type', 'LANG')
    .order('title');

  const langCategories: LearningCategory[] = categories ?? [];
  if (langCategories.length === 0) redirect('/student/dashboard');

  const categoryId = params.category ?? langCategories[0].id;
  const activeCategory = langCategories.find(c => c.id === categoryId);
  if (!activeCategory) redirect('/student/language');

  const { data: statsRaw } = await supabase
    .from('weakness_stats')
    .select('*')
    .eq('user_id', user.id)
    .eq('category_id', categoryId);

  const stats: WeaknessStat[] = statsRaw ?? [];

  return (
    <div className="space-y-8">
      {/* 언어 카테고리 탭 */}
      {langCategories.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {langCategories.map(cat => (
            <a
              key={cat.id}
              href={`/student/language?category=${cat.id}`}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all
                ${cat.id === categoryId
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}
            >
              {cat.title}
            </a>
          ))}
        </div>
      )}

      <LanguageDashboard
        category={activeCategory}
        stats={stats}
        categoryId={categoryId}
      />
    </div>
  );
}
