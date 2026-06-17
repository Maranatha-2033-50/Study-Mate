import type { LanguageExamCard } from '@/types';

export interface ExamQuestionRow {
  id:            string;
  question_type: string;
  chapter_id:    string;
  learning_chapters: {
    level_1: string;
    level_2: string;
    category_id?: string | null;
    curriculum_code?: string | null;
    country?:     string | null;
    grade_level?: string | null;
    stream?:      string | null;
    course?:      string | null;
  } | null;
}

// 교과 글로벌 커리큘럼 트랙 메타 — 대시보드 카탈로그 그룹 헤더/뱃지용
export const CURRICULUM_META: Record<string, { label: string; badge: string }> = {
  KR_HIGH_MATH:   { label: '🇰🇷 대한민국 고등 수학 (내신·수능)',   badge: 'bg-rose-50 text-rose-600 border-rose-200' },
  UK_ALEVEL_MATH: { label: '🇬🇧 영국 A-Level Mathematics',         badge: 'bg-blue-50 text-blue-600 border-blue-200' },
  CA_ON_MATH:     { label: '🇨🇦 캐나다 온타리오 수학 (G11–12)',     badge: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
};

// 시드된 문항을 실전 모의고사 카드 목록으로 변환 (전 카테고리 공용)
//  - 객관식/단답: 단원(chapter)별로 묶어 DiagnosticTestRoom 으로 라우팅
//  - ESSAY: 문항별 EssayTestRoom(주관식 AI 첨삭) 으로 라우팅
interface ChapterTree { country: string | null; gradeLevel: string | null; stream: string | null; course: string | null }

export function buildExams(rows: ExamQuestionRow[], categoryId: string): LanguageExamCard[] {
  const objectiveByChapter = new Map<string, { skill: string; level_2: string; curriculumCode: string | null; tree: ChapterTree; catId: string; count: number }>();
  const essays: LanguageExamCard[] = [];

  for (const r of rows) {
    const skill   = r.learning_chapters?.level_1 ?? '문제';
    const level_2 = r.learning_chapters?.level_2 ?? '';
    const curriculumCode = r.learning_chapters?.curriculum_code ?? null;
    const rowCategoryId = r.learning_chapters?.category_id ?? categoryId;  // 카드별 정확한 카테고리 라우팅
    const tree: ChapterTree = {
      country:    r.learning_chapters?.country ?? null,
      gradeLevel: r.learning_chapters?.grade_level ?? null,
      stream:     r.learning_chapters?.stream ?? null,
      course:     r.learning_chapters?.course ?? null,
    };
    if (r.question_type === 'ESSAY') {
      essays.push({
        id:            r.id,
        kind:          'ESSAY',
        skill:         skill || 'Writing',
        title:         level_2 || 'Writing Task 2',
        questionCount: 1,
        href:          `/student/writing?category=${rowCategoryId}&question=${r.id}`,
        curriculumCode,
        ...tree,
      });
    } else {
      const cur = objectiveByChapter.get(r.chapter_id) ?? { skill, level_2, curriculumCode, tree, catId: rowCategoryId, count: 0 };
      cur.count += 1;
      objectiveByChapter.set(r.chapter_id, cur);
    }
  }

  const objective: LanguageExamCard[] = [...objectiveByChapter.entries()].map(
    ([chapterId, { skill, level_2, curriculumCode, tree, catId, count }]) => ({
      id:            chapterId,
      kind:          'OBJECTIVE',
      skill,
      title:         level_2 || `${skill} Practice`,
      questionCount: count,
      href:          `/student/diagnostic?category=${catId}&chapter=${chapterId}`,
      curriculumCode,
      ...tree,
    }),
  );

  return [...objective, ...essays];
}
