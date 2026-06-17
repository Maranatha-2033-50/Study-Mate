import { create } from 'zustand';

/* ────────────────────────────────────────────────────────────────────────────
   SCHOOL 글로벌 교과 — GNB ↔ CurriculumExplorer 상태 결합 스토어
   - CurriculumExplorer가 국가/학년/목적 선택에 따라 가능한 Course 목록을 publish
   - 상단 GNB(SchoolGnbTabs)가 그 Course 목록을 탭으로 렌더, 선택 시 activeCourse 설정
   - Explorer는 activeCourse로 카드 그리드를 필터링 → 양방향 동기화
──────────────────────────────────────────────────────────────────────────── */
interface CurriculumState {
  courses:         string[];
  activeCourse:    string | null;
  setCourses:      (courses: string[]) => void;
  setActiveCourse: (course: string | null) => void;
}

export const useCurriculumStore = create<CurriculumState>((set) => ({
  courses:         [],
  activeCourse:    null,
  setCourses:      (courses) => set({ courses }),
  setActiveCourse: (activeCourse) => set({ activeCourse }),
}));
