'use client';

import { useState } from 'react';
import type { AIStudyPlan, WeaknessStat } from '@/types';

interface WeaknessPlannerProps {
  categoryTitle: string;
  weakStats: WeaknessStat[];
}

export function WeaknessPlanner({ categoryTitle, weakStats }: WeaknessPlannerProps) {
  const [examDate,       setExamDate]       = useState('');
  const [availableHours, setAvailableHours] = useState(2);
  const [plan,           setPlan]           = useState<AIStudyPlan | null>(null);
  const [generating,     setGenerating]     = useState(false);
  const [error,          setError]          = useState('');

  const weakChapters = weakStats
    .sort((a, b) => a.accuracy_rate - b.accuracy_rate)
    .slice(0, 5)
    .map((s) => ({
      level_1:      s.level_1,
      level_2:      s.level_2,
      accuracy_rate: s.accuracy_rate,
    }));

  const generate = async () => {
    if (!examDate) { setError('목표 시험일을 입력해 주세요.'); return; }
    if (weakChapters.length === 0) { setError('취약 단원 데이터가 부족합니다. 먼저 진단 평가를 완료해 주세요.'); return; }

    setError('');
    setGenerating(true);

    try {
      const res = await fetch('/api/plan-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_title:  categoryTitle,
          weak_chapters:   weakChapters,
          exam_date:       examDate,
          available_hours: availableHours,
        }),
      });

      if (!res.ok) throw new Error('플래너 생성 실패');
      const data = await res.json();
      setPlan(data.plan);
    } catch (e) {
      setError('AI 플래너 생성 중 오류가 발생했습니다.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Input form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-800 mb-4">AI 맞춤형 학습 플래너 생성</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <label className="space-y-1">
            <span className="text-xs font-medium text-gray-500">목표 시험일</span>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm
                         focus:outline-none focus:border-brand-400"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-gray-500">
              하루 가용 시간 ({availableHours}시간)
            </span>
            <input
              type="range"
              min={0.5}
              max={8}
              step={0.5}
              value={availableHours}
              onChange={(e) => setAvailableHours(Number(e.target.value))}
              className="w-full"
            />
          </label>
        </div>

        {/* Top weak chapters preview */}
        {weakChapters.length > 0 && (
          <div className="mb-4 space-y-1">
            <p className="text-xs font-medium text-gray-500">집중 공략 단원 (AI 자동 선정)</p>
            <div className="flex flex-wrap gap-2">
              {weakChapters.map((w, i) => (
                <span key={i} className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full border border-red-200">
                  {w.level_2} ({w.accuracy_rate}%)
                </span>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <button
          onClick={generate}
          disabled={generating}
          className="w-full py-3 bg-brand-600 text-white rounded-xl text-sm font-medium
                     hover:bg-brand-700 disabled:opacity-60 transition-colors"
        >
          {generating ? 'AI 플래너 생성 중…' : '🤖 맞춤 학습 플랜 생성하기'}
        </button>
      </div>

      {/* Generated plan */}
      {plan && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
          <div>
            <h4 className="font-semibold text-gray-800 mb-1">전략 요약</h4>
            <p className="text-sm text-gray-600 leading-6">{plan.summary}</p>
          </div>

          <div className="bg-brand-50 rounded-xl px-4 py-3 border border-brand-100">
            <p className="text-sm font-semibold text-brand-700">이번 주 핵심 목표</p>
            <p className="text-sm text-brand-600 mt-1">{plan.weekly_goal}</p>
          </div>

          {/* Daily plan table */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">7일 학습 루틴</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left text-gray-500 font-medium border border-gray-200">날짜</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium border border-gray-200">교시</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium border border-gray-200">단원</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium border border-gray-200">학습 과제</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium border border-gray-200">시간</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.daily_plans.flatMap((day, di) =>
                    day.sessions.map((s, si) => (
                      <tr key={`${di}-${si}`} className={di % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        {si === 0 && (
                          <td
                            rowSpan={day.sessions.length}
                            className="px-3 py-2 border border-gray-200 font-medium text-gray-700 align-top"
                          >
                            {day.date}
                          </td>
                        )}
                        <td className="px-3 py-2 border border-gray-200 text-gray-500">{s.time_slot}</td>
                        <td className="px-3 py-2 border border-gray-200 text-gray-700">{s.chapter}</td>
                        <td className="px-3 py-2 border border-gray-200 text-gray-600">{s.task}</td>
                        <td className="px-3 py-2 border border-gray-200 text-right text-gray-500">{s.duration_min}분</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tips */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">AI 학습 팁</h4>
            <ul className="space-y-1">
              {plan.tips.map((tip, i) => (
                <li key={i} className="text-sm text-gray-600 flex gap-2">
                  <span className="text-brand-500 font-bold">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
