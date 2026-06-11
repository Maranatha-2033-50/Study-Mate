import type { LanguageExamCard } from '@/types';

export interface ExamQuestionRow {
  id:            string;
  question_type: string;
  chapter_id:    string;
  learning_chapters: { level_1: string; level_2: string } | null;
}

// 시드된 문항을 실전 모의고사 카드 목록으로 변환 (전 카테고리 공용)
//  - 객관식/단답: 단원(chapter)별로 묶어 DiagnosticTestRoom 으로 라우팅
//  - ESSAY: 문항별 EssayTestRoom(주관식 AI 첨삭) 으로 라우팅
export function buildExams(rows: ExamQuestionRow[], categoryId: string): LanguageExamCard[] {
  const objectiveByChapter = new Map<string, { skill: string; level_2: string; count: number }>();
  const essays: LanguageExamCard[] = [];

  for (const r of rows) {
    const skill   = r.learning_chapters?.level_1 ?? '문제';
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
