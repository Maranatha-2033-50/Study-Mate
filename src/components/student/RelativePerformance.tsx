'use client';

import type { WeaknessStat } from '@/types';

interface RelativePerformanceProps {
  stats: WeaknessStat[];
  systemAverages: Record<string, number>;   // level_1 → 전체 유저 평균 정답률(%)
}

export function RelativePerformance({ stats, systemAverages }: RelativePerformanceProps) {
  if (stats.length === 0) return null;

  // Aggregate user accuracy by level_1
  const userByLevel1 = stats.reduce<Record<string, { total: number; correct: number }>>(
    (acc, s) => {
      if (!acc[s.level_1]) acc[s.level_1] = { total: 0, correct: 0 };
      acc[s.level_1].total   += s.total_attempts;
      acc[s.level_1].correct += s.correct_count;
      return acc;
    },
    {}
  );

  // 전체 유저 평균이 집계된 영역만 비교 (하드코딩 제거)
  const comparisons = Object.entries(userByLevel1)
    .map(([level_1, { total, correct }]) => {
      const userRate = total === 0 ? 0 : Math.round((correct / total) * 100);
      const sysRate  = systemAverages[level_1];
      return { level_1, userRate, sysRate, diff: sysRate == null ? null : userRate - Math.round(sysRate) };
    })
    .filter((c): c is { level_1: string; userRate: number; sysRate: number; diff: number } => c.diff !== null)
    .sort((a, b) => a.diff - b.diff); // weakest first

  if (comparisons.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <p className="text-sm font-semibold text-amber-800 mb-1">상대적 위치 지표</p>
        <p className="text-xs text-amber-700">
          전체 학습자 평균 데이터를 수집하고 있습니다. 더 많은 학습이 쌓이면 영역별 상대 위치가 표시됩니다.
        </p>
      </div>
    );
  }

  const weakest = comparisons[0];

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
      <p className="text-sm font-semibold text-amber-800 mb-3">상대적 위치 지표</p>
      {weakest && weakest.diff < 0 && (
        <p className="text-sm text-amber-700 mb-3">
          전체 학습자 평균 대비{' '}
          <span className="font-bold text-red-600">[{weakest.level_1}]</span> 영역이
          취약합니다 ({weakest.userRate}% vs 평균 {Math.round(weakest.sysRate)}%).
        </p>
      )}
      <div className="space-y-2">
        {comparisons.map(({ level_1, userRate, diff }) => (
          <div key={level_1} className="flex items-center gap-3 text-xs">
            <span className="w-24 truncate font-medium text-gray-700">{level_1}</span>
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{ width: `${userRate}%` }}
              />
            </div>
            <span className={`w-12 text-right font-semibold ${diff < 0 ? 'text-red-500' : 'text-green-600'}`}>
              {diff >= 0 ? '+' : ''}{diff}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
