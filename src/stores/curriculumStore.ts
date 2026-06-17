import { create } from 'zustand';

/* ────────────────────────────────────────────────────────────────────────────
   SCHOOL 글로벌 교과 마스터 필터 (GNB ↔ 대시보드 본문 관통 전역 상태)
   - 상단 GNB의 SchoolMasterFilter가 country→grade→stream을 set
   - 대시보드 본문(SchoolDashboard)이 이 필터를 구독해 카드·통계·페이스메이커를 재계산
   - 캐스케이딩 락: 상위 변경 시 하위 선택을 자동 초기화
──────────────────────────────────────────────────────────────────────────── */
interface CurriculumFilter {
  country: string;
  grade:   string;
  stream:  string;
  setCountry: (v: string) => void;
  setGrade:   (v: string) => void;
  setStream:  (v: string) => void;
  reset:      () => void;
}

export const useCurriculumStore = create<CurriculumFilter>((set) => ({
  country: '',
  grade:   '',
  stream:  '',
  setCountry: (country) => set({ country, grade: '', stream: '' }),
  setGrade:   (grade)   => set({ grade, stream: '' }),
  setStream:  (stream)  => set({ stream }),
  reset:      () => set({ country: '', grade: '', stream: '' }),
}));
