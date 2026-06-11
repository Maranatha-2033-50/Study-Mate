import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LanguageDashboard } from '@/components/student/LanguageDashboard';
import type { WeaknessStat, LearningCategory, LanguageExamCard } from '@/types';

interface ExamQuestionRow {
  id:            string;
  question_type: string;
  chapter_id:    string;
  learning_chapters: { level_1: string; level_2: string } | null;
}

// 시드된 문항을 실전 모의고사 카드 목록으로 변환
function buildExams(rows: ExamQuestionRow[], categoryId: string): LanguageExamCard[] {
  const objectiveByChapter = new Map<string, { skill: string; level_2: string; count: number }>();
  const essays: LanguageExamCard[] = [];

  for (const r of rows) {
    const skill   = r.learning_chapters?.level_1 ?? 'Reading';
    const level_2 = r.learning_chapters?.level_2 ?? '';
    if (r.question_type === 'ESSAY') {
      essays.push({
        id:            r.id,
        kind:          'ESSAY',
        skill:         skill || 'Writing',
        title:         level_2 || 'Writing Task 2',
        questionCount: 1,
        href:          `/student/writing?category=${categoryId}&question=${r.id}`,
      });
    } else {
      const cur = objectiveByChapter.get(r.chapter_id) ?? { skill, level_2, count: 0 };
      cur.count += 1;
      objectiveByChapter.set(r.chapter_id, cur);
    }
  }

  const objective: LanguageExamCard[] = [...objectiveByChapter.entries()].map(
    ([chapterId, { skill, level_2, count }]) => ({
      id:            chapterId,
      kind:          'OBJECTIVE',
      skill,
      title:         level_2 || `${skill} Practice`,
      questionCount: count,
      href:          `/student/diagnostic?category=${categoryId}&chapter=${chapterId}`,
    }),
  );

  return [...objective, ...essays];
}

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

  // 실전 모의고사 카드 — 시드된 문항 기반
  const { data: examRows } = await supabase
    .from('universal_questions')
    .select('id, question_type, chapter_id, learning_chapters!inner(category_id, level_1, level_2)')
    .eq('learning_chapters.category_id', categoryId);

  const exams = buildExams((examRows ?? []) as unknown as ExamQuestionRow[], categoryId);

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
        exams={exams}
      />
    </div>
  );
}
