'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Sparkles, ArrowRight, Lock } from 'lucide-react';

interface Props {
  name:    string;
  hasPlan: boolean;
  dDay:    number;
  pct:     number;
  done:    number;
  total:   number;
}

export function PacemakerBanner({ name, hasPlan, dDay, pct, done, total }: Props) {
  // 마운트 후 0 → pct 로 게이지 애니메이션
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(pct), 120);
    return () => clearTimeout(t);
  }, [pct]);

  const who = name || '수험생';

  // ── 가드: 플랜 없음 → 유도 ──
  if (!hasPlan) {
    return (
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5
                      flex items-center justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-bold text-indigo-700">
            <Sparkles size={15} /> 아직 설정된 합격 로드맵이 없습니다
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            시험 날짜와 요일별 가용 시간만 입력하면 AI가 합격 로드맵을 설계해 드려요.
          </p>
        </div>
        <Link
          href="/student/planner"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white
                     text-sm font-semibold hover:bg-indigo-700 transition-colors whitespace-nowrap"
        >
          ✨ 1초 만에 AI 맞춤형 합격 플랜 짜기 <ArrowRight size={15} />
        </Link>
      </div>
    );
  }

  // ── 달성률 기반 다이내믹 격려 ──
  const tail =
    pct >= 100 ? '오늘 목표를 완벽히 끝냈어요! 🎉'
    : pct >= 70 ? '거의 다 왔어요, 조금만 더 힘내세요! 🚀'
    : pct >= 30 ? '좋은 흐름이에요, 이대로 계속 이어가요! 💪'
    : pct > 0   ? '시작이 반입니다, 한 걸음만 더! 🔥'
    :             '오늘의 첫 마일스톤을 체크해 볼까요? ✨';

  return (
    <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white p-6
                    shadow-lg shadow-indigo-200/60">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="flex items-center gap-1.5 text-indigo-200 text-xs font-semibold uppercase tracking-widest mb-1.5">
            <Lock size={12} /> 나의 AI 합격 로드맵 · 실시간 진행도
          </p>
          <p className="text-sm sm:text-base font-bold leading-relaxed">
            {who}님, 목표 시험까지 <span className="text-white">D-{Math.max(0, dDay)}</span> 남았습니다!{' '}
            오늘 할당량 <span className="text-white">{pct}%</span> 달성. {tail}
          </p>
        </div>
        <Link
          href="/student/planner"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25
                     text-white text-sm font-semibold transition-colors whitespace-nowrap"
        >
          나의 학습 계획 상세보기 <ArrowRight size={15} />
        </Link>
      </div>

      {/* 프로그레스 게이지 */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-indigo-100 mb-1.5">
          <span>달성 마일스톤 {done}/{total}</span>
          <span className="font-bold text-white">{pct}%</span>
        </div>
        <div className="w-full bg-white/20 rounded-full h-2.5 overflow-hidden">
          <div
            className="h-2.5 rounded-full bg-white transition-all duration-1000 ease-out"
            style={{ width: `${w}%` }}
          />
        </div>
      </div>
    </div>
  );
}
