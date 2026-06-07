'use client';

import type { WeaknessStat } from '@/types';

// Placeholder system-average data (replace with real aggregation query)
const SYSTEM_AVERAGE: Record<string, number> = {
  Reading:        72,
  Listening:      68,
  Writing:        55,
  Speaking:       60,
  '데이터베이스':  65,
  '소프트웨어 공학': 70,
};

interface RelativePerformanceProps {
  stats: WeaknessStat[];
}

export function RelativePerformance({ stats }: RelativePerformanceProps) {
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

  const comparisons = Object.entries(userByLevel1)
    .map(([level_1, { total, correct }]) => {
      const userRate = total === 0 ? 0 : Math.round((correct / total) * 100);
      const sysRate  = SYSTEM_AVERAGE[level_1] ?? 65;
      const diff     = userRate - sysRate;
      return { level_1, userRate, sysRate, diff };
    })
    .sort((a, b) => a.diff - b.diff); // weakest first

  const weakest = comparisons[0];

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
      <p className="text-sm font-semibold text-amber-800 mb-3">상대적 위치 지표</p>
      {weakest && weakest.diff < 0 && (
        <p className="text-sm text-amber-700 mb-3">
          상위 학습자 평균 대비{' '}
          <span className="font-bold text-red-600">[{weakest.level_1}]</span> 영역이
          취약합니다 ({weakest.userRate}% vs 평균 {weakest.sysRate}%).
        </p>
      )}
      <div className="space-y-2">
        {comparisons.map(({ level_1, userRate, sysRate, diff }) => (
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
