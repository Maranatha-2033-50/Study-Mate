import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { IncorrectNotebook, type IncorrectItem } from '@/components/student/IncorrectNotebook';
import type { CategoryType, QuestionType, QuestionOptions } from '@/types';

export const metadata = { title: '나의 오답노트 | Study Mate' };

// Supabase 임베드 조인 결과 원형
interface RawRow {
  question_id: string;
  user_answer: string;
  is_correct:  boolean;
  created_at:  string;
  universal_questions: {
    id:            string;
    chapter_id:    string;
    question_type: QuestionType;
    question_text: string;
    options:       QuestionOptions | null;
    answer:        string;
    difficulty:    string;
    explanation:   string | null;
    passage:       string | null;
    learning_chapters: { category_id: string; level_1: string; level_2: string } | null;
  } | null;
}

export default async function IncorrectPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 카테고리 → 유형/제목 매핑 (탭 분류용)
  const { data: categories } = await supabase
    .from('learning_categories')
    .select('id, type, title');

  const catMap = new Map<string, { type: CategoryType; title: string }>();
  for (const c of (categories ?? []) as { id: string; type: CategoryType; title: string }[]) {
    catMap.set(c.id, { type: c.type, title: c.title });
  }

  // 내 모든 응시 기록을 문항 상세와 함께 최신순으로 — study_sessions 로 본인 소유만 필터
  const { data: rowsRaw } = await supabase
    .from('user_attempts')
    .select(`
      question_id, user_answer, is_correct, created_at,
      study_sessions!inner ( user_id ),
      universal_questions!inner (
        id, chapter_id, question_type, question_text, options, answer, difficulty, explanation, passage,
        learning_chapters!inner ( category_id, level_1, level_2 )
      )
    `)
    .eq('study_sessions.user_id', user.id)
    .order('created_at', { ascending: false });

  const rows = (rowsRaw ?? []) as unknown as RawRow[];

  // 문항별 그룹화: desc 정렬이라 첫 등장이 곧 '가장 최근 시도'.
  // wrongCount 는 전체 이력 중 오답 누적 횟수.
  const latest      = new Map<string, RawRow>();
  const wrongCount  = new Map<string, number>();
  for (const r of rows) {
    if (!latest.has(r.question_id)) latest.set(r.question_id, r);
    if (!r.is_correct) wrongCount.set(r.question_id, (wrongCount.get(r.question_id) ?? 0) + 1);
  }

  const items: IncorrectItem[] = [];
  for (const [qid, r] of latest) {
    if (r.is_correct) continue;                          // 최신 시도가 정답 → 이미 정복 → 제외
    const q = r.universal_questions;
    if (!q || q.question_type === 'ESSAY') continue;     // 주관식 에세이는 객관 재채점 대상 아님
    const ch  = q.learning_chapters;
    const cat = ch ? catMap.get(ch.category_id) : undefined;
    if (!ch || !cat) continue;

    items.push({
      questionId:      qid,
      chapterId:       q.chapter_id,
      questionType:    q.question_type,
      questionText:    q.question_text,
      options:         q.options,
      answer:          q.answer,
      difficulty:      q.difficulty,
      explanation:     q.explanation,
      passage:         q.passage,
      level_1:         ch.level_1,
      level_2:         ch.level_2,
      categoryId:      ch.category_id,
      categoryType:    cat.type,
      categoryTitle:   cat.title,
      lastWrongAnswer: r.user_answer,
      lastWrongAt:     r.created_at,
      wrongCount:      wrongCount.get(qid) ?? 1,
    });
  }

  // 최신 오답 순 정렬
  items.sort((a, b) => (a.lastWrongAt < b.lastWrongAt ? 1 : -1));

  return <IncorrectNotebook items={items} />;
}
