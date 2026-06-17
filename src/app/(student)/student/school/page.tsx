import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StudentShell } from '@/components/layout/StudentChrome';
import { SchoolDashboard, type SchoolStat, type SchoolPlan, type ChapterMeta } from '@/components/student/SchoolDashboard';
import { buildExams, type ExamQuestionRow } from '@/lib/exams';

export const metadata = { title: '교과 학습 | Study Mate' };

interface RawRow {
  id: string;
  question_type: string;
  chapter_id: string;
  learning_chapters: {
    category_id: string; level_1: string; level_2: string; curriculum_code: string | null;
    country: string | null; grade_level: string | null; stream: string | null; course: string | null;
  } | null;
}

export default async function SchoolPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // SCHOOL 카테고리 전체 — 글로벌 트리는 카테고리 경계를 넘어 단원 단위로 스코프한다.
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
          아직 교과 학습 콘텐츠가 없습니다. 곧 추가될 예정입니다.
        </div>
      </StudentShell>
    );
  }

  const [{ data: examRows }, { data: statsRaw }, { data: sessRaw }, { data: plansRaw }, { data: profile }] =
    await Promise.all([
      supabase
        .from('universal_questions')
        .select('id, question_type, chapter_id, learning_chapters!inner(category_id, level_1, level_2, curriculum_code, country, grade_level, stream, course)')
        .in('learning_chapters.category_id', catIds),
      supabase.from('weakness_stats').select('*').eq('user_id', user.id).in('category_id', catIds),
      supabase.from('study_sessions').select('id, category_id').eq('user_id', user.id).in('category_id', catIds).eq('status', 'COMPLETED'),
      supabase.from('ai_study_plans').select('*').eq('user_id', user.id).in('category_id', catIds).order('updated_at', { ascending: false }),
      supabase.from('profiles').select('name').eq('id', user.id).maybeSingle(),
    ]);

  const rows = (examRows ?? []) as unknown as RawRow[];
  const exams = buildExams(rows as unknown as ExamQuestionRow[], catIds[0]);

  // chapter_id → 트리/카테고리 메타 (통계·세션·플랜 필터링용)
  const chapterMeta: Record<string, ChapterMeta> = {};
  for (const r of rows) {
    const lc = r.learning_chapters;
    if (lc && !chapterMeta[r.chapter_id]) {
      chapterMeta[r.chapter_id] = {
        country: lc.country, grade: lc.grade_level, stream: lc.stream, category_id: lc.category_id,
      };
    }
  }

  return (
    <StudentShell>
      <SchoolDashboard
        exams={exams}
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
