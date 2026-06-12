// 난이도 라벨 → 배지 스타일 매핑.
// 레거시(상/중/하)와 한국 교과 시장 맞춤 액센트 라벨을 모두 안전하게 처리하며,
// 알 수 없는 라벨도 깨지지 않고 중립 배지로 폴백한다.

export interface DifficultyStyle {
  label: string;
  badge: string;   // tailwind 배지 클래스
}

const STYLES: Record<string, DifficultyStyle> = {
  // 레거시 규격
  '상': { label: '상', badge: 'bg-rose-100 text-rose-600' },
  '중': { label: '중', badge: 'bg-amber-100 text-amber-600' },
  '하': { label: '하', badge: 'bg-emerald-100 text-emerald-600' },
  // 한국 내신·수능 맞춤 액센트
  '1등급 도전':     { label: '1등급 도전',     badge: 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' },
  '2~3등급 굳히기': { label: '2~3등급 굳히기', badge: 'bg-sky-100 text-sky-700' },
  '개념 다지기':    { label: '개념 다지기',    badge: 'bg-emerald-100 text-emerald-700' },
};

export function difficultyStyle(d: string | null | undefined): DifficultyStyle {
  if (!d) return { label: '–', badge: 'bg-slate-100 text-slate-500' };
  return STYLES[d] ?? { label: d, badge: 'bg-slate-100 text-slate-600' };
}
