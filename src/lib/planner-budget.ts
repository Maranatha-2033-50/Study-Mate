import type { AvailabilityMatrix, WeekdayKey } from '@/types';

// JS Date.getDay(): 0=일 … 6=토 → availability_matrix 키 매핑
const DAY_INDEX_TO_KEY: WeekdayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export const WEEKDAYS: { key: WeekdayKey; label: string }[] = [
  { key: 'mon', label: '월' },
  { key: 'tue', label: '화' },
  { key: 'wed', label: '수' },
  { key: 'thu', label: '목' },
  { key: 'fri', label: '금' },
  { key: 'sat', label: '토' },
  { key: 'sun', label: '일' },
];

export function emptyMatrix(fill = 0): AvailabilityMatrix {
  return { mon: fill, tue: fill, wed: fill, thu: fill, fri: fill, sat: fill, sun: fill };
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * 오늘(포함)부터 exam_date(포함)까지 모든 날짜를 순회하며,
 * 각 날짜 요일의 가용 시간을 합산해 총 학습 가용 시간(Study Budget)을 계산한다.
 */
export function computeStudyBudget(
  examDate: string,
  matrix: Partial<AvailabilityMatrix>,
): { totalHours: number; dDay: number } {
  const today = startOfDay(new Date());
  const exam = startOfDay(new Date(`${examDate}T00:00:00`));

  const dDay = Math.round((exam.getTime() - today.getTime()) / 86_400_000);
  if (isNaN(exam.getTime()) || dDay < 0) return { totalHours: 0, dDay: 0 };

  let total = 0;
  for (const d = new Date(today); d <= exam; d.setDate(d.getDate() + 1)) {
    const key = DAY_INDEX_TO_KEY[d.getDay()];
    total += Number(matrix[key] ?? 0);
  }
  return { totalHours: Math.round(total), dDay };
}
