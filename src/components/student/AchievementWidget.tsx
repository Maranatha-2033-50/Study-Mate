'use client';

import { Compass, BarChart2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { RadarChart } from '@/components/ui/RadarChart';
import { LineChart } from '@/components/ui/LineChart';
import type { WeaknessStat } from '@/types';

interface AchievementWidgetProps {
  stats: WeaknessStat[];
  trend: { date: string; accuracy: number }[];
}

/* ── 학습 기록 없을 때 Empty State ── */
function EmptyState() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm
                    flex flex-col items-center text-center py-16 px-8">
      {/* 아이콘 + 링 */}
      <div className="relative mb-6">
        <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center">
          <Compass className="text-indigo-400" size={36} strokeWidth={1.5} />
        </div>
        {/* 장식 도트 */}
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full
                         border-2 border-white animate-pulse" />
      </div>

      <h3 className="text-lg font-bold text-slate-700 mb-2">
        아직 학습 기록이 없습니다
      </h3>
      <p className="text-sm text-slate-400 leading-7 max-w-xs mb-8">
        먼저{' '}
        <span className="font-semibold text-indigo-500">진단 평가</span>를 시작하여
        나만의 맞춤형 학습 지도를 만들어 보세요!<br />
        진단 결과가 쌓이면 영역별 성취도와 추이가 이곳에 표시됩니다.
      </p>

      <Link
        href="/student/diagnostic"
        className="inline-flex items-center gap-2 px-6 py-2.5
                   bg-indigo-600 text-white text-sm font-semibold rounded-xl
                   hover:bg-indigo-700 shadow-sm hover:shadow-indigo-200 hover:shadow-md
                   transition-all duration-200"
      >
        진단 평가 시작하기
        <ArrowRight size={15} />
      </Link>
    </div>
  );
}

/* ── 메인 위젯 ── */
export function AchievementWidget({ stats, trend }: AchievementWidgetProps) {
  if (stats.length === 0) return <EmptyState />;

  /* 레이더용: level_1별 집계 */
  const byLevel1 = stats.reduce<Record<string, { total: number; correct: number }>>(
    (acc, s) => {
      if (!acc[s.level_1]) acc[s.level_1] = { total: 0, correct: 0 };
      acc[s.level_1].total   += s.total_attempts;
      acc[s.level_1].correct += s.correct_count;
      return acc;
    },
    {}
  );

  const radarLabels = Object.keys(byLevel1);
  const radarData   = radarLabels.map((l) => {
    const { total, correct } = byLevel1[l];
    return total === 0 ? 0 : Math.round((correct / total) * 100);
  });

  const lineLabels = trend.slice(-8).map((t) => t.date.slice(5));
  const lineData   = trend.slice(-8).map((t) => t.accuracy);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

      {/* 레이더 차트 */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm
                      hover:shadow-md transition-all duration-300 p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-2 h-2 rounded-full bg-indigo-500" />
          <h3 className="text-sm font-semibold text-slate-600">영역별 정답률</h3>
        </div>
        <RadarChart
          labels={radarLabels}
          datasets={[{ label: '내 정답률 (%)', data: radarData, color: '#6366f1' }]}
        />
      </div>

      {/* 라인 차트 */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm
                      hover:shadow-md transition-all duration-300 p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <h3 className="text-sm font-semibold text-slate-600">성취도 추이</h3>
        </div>
        {trend.length >= 2 ? (
          <LineChart
            labels={lineLabels}
            datasets={[{ label: '정답률 (%)', data: lineData, color: '#10b981' }]}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <BarChart2 className="text-slate-200" size={40} strokeWidth={1.5} />
            <p className="text-xs text-slate-400 text-center leading-5">
              평가를 2회 이상 완료하면<br />성취도 추이가 표시됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
