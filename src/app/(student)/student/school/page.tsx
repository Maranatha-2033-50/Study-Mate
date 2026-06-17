import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StudentShell } from '@/components/layout/StudentChrome';
import { SchoolDashboard, type SchoolStat, type SchoolPlan, type ChapterMeta } from '@/components/student/SchoolDashboard';

export const metadata = { title: '교과 학습 | Study Mate' };

export default async function SchoolPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: catsRaw } = await supabase
    .from('learning_categories')
    .select('id, title')
    .eq('type', 'SCHOOL')
    .order('title');
  const catIds = (catsRaw ?? []).map((c) => c.id);

  if (catIds.length === 0) {
    return (
      <StudentShell>
        <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-slate-400 shadow-sm">
          아직 교과 학습 콘텐츠가 없습니다. 상단 필터에서 과목을 선택해 AI 출제를 시작하세요.
        </div>
      </StudentShell>
    );
  }

  const [{ data: chRaw }, { data: statsRaw }, { data: sessRaw }, { data: plansRaw }, { data: profile }] =
    await Promise.all([
      supabase.from('learning_chapters').select('id, category_id, country, grade_level, stream').in('category_id', catIds),
      supabase.from('weakness_stats').select('*').eq('user_id', user.id).in('category_id', catIds),
      supabase.from('study_sessions').select('id, category_id').eq('user_id', user.id).in('category_id', catIds).eq('status', 'COMPLETED'),
      supabase.from('ai_study_plans').select('*').eq('user_id', user.id).in('category_id', catIds).order('updated_at', { ascending: false }),
      supabase.from('profiles').select('name').eq('id', user.id).maybeSingle(),
    ]);

  // chapter_id → 트리/카테고리 메타 (통계 필터링용)
  const chapterMeta: Record<string, ChapterMeta> = {};
  for (const c of (chRaw ?? []) as { id: string; category_id: string; country: string | null; grade_level: string | null; stream: string | null }[]) {
    chapterMeta[c.id] = { country: c.country, grade: c.grade_level, stream: c.stream, category_id: c.category_id };
  }

  return (
    <StudentShell>
      <SchoolDashboard
        stats={(statsRaw ?? []) as SchoolStat[]}
        sessions={(sessRaw ?? []) as { category_id: string }[]}
        plans={(plansRaw ?? []) as SchoolPlan[]}
        chapterMeta={chapterMeta}
        profileName={profile?.name ?? ''}
        primaryCategoryId={catIds[0]}
      />
    </StudentShell>
  );
}
