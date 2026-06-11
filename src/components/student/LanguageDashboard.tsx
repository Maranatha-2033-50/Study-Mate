'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { WeaknessStat, LearningCategory, LanguageExamCard } from '@/types';

// ─── Band Score helper ────────────────────────────────────────────────────────
function toBand(accuracy: number): number {
  if (accuracy >= 95) return 9.0;
  if (accuracy >= 88) return 8.5;
  if (accuracy >= 82) return 8.0;
  if (accuracy >= 75) return 7.5;
  if (accuracy >= 68) return 7.0;
  if (accuracy >= 60) return 6.5;
  if (accuracy >= 52) return 6.0;
  if (accuracy >= 44) return 5.5;
  if (accuracy >= 36) return 5.0;
  if (accuracy >= 28) return 4.5;
  return 4.0;
}

function bandColor(b: number) {
  if (b >= 7.5) return { text: 'text-emerald-600', bar: 'bg-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  if (b >= 6.5) return { text: 'text-blue-600',    bar: 'bg-blue-500',    bg: 'bg-blue-50',    border: 'border-blue-200' };
  if (b >= 5.5) return { text: 'text-amber-600',   bar: 'bg-amber-500',   bg: 'bg-amber-50',   border: 'border-amber-200' };
  return         { text: 'text-rose-500',    bar: 'bg-rose-500',    bg: 'bg-rose-50',    border: 'border-rose-200' };
}

// ─── Skill metadata ───────────────────────────────────────────────────────────
const SKILL_META: Record<string, { icon: string; color: string; bg: string; border: string; bar: string }> = {
  Listening:    { icon: '🎧', color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-200',  bar: 'bg-indigo-500' },
  Reading:      { icon: '📖', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', bar: 'bg-emerald-500' },
  Writing:      { icon: '✍️',  color: 'text-amber-600',  bg: 'bg-amber-50',   border: 'border-amber-200',   bar: 'bg-amber-500' },
  Speaking:     { icon: '🎤', color: 'text-rose-500',    bg: 'bg-rose-50',    border: 'border-rose-200',    bar: 'bg-rose-500' },
  default:      { icon: '📝', color: 'text-slate-600',   bg: 'bg-slate-50',   border: 'border-slate-200',   bar: 'bg-slate-500' },
};

const SKILL_ORDER = ['Listening', 'Reading', 'Writing', 'Speaking'];

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  category:   LearningCategory;
  stats:      WeaknessStat[];
  categoryId: string;
  exams:      LanguageExamCard[];
}

// ─── Component ───────────────────────────────────────────────────────────────
export function LanguageDashboard({ category, stats, categoryId, exams }: Props) {
  const [activeSkill, setActiveSkill] = useState<string>('ALL');

  // Group stats by level_1 (skill)
  const skillMap: Record<string, WeaknessStat[]> = {};
  for (const s of stats) {
    (skillMap[s.level_1] ??= []).push(s);
  }

  // Ordered skill list
  const skillNames  = Object.keys(skillMap);
  const orderedSkills = [
    ...SKILL_ORDER.filter(s => skillNames.includes(s)),
    ...skillNames.filter(s => !SKILL_ORDER.includes(s)),
  ];

  // Per-skill summaries
  const skillSummaries = orderedSkills.map(skill => {
    const sl         = skillMap[skill];
    const attempts   = sl.reduce((a, s) => a + s.total_attempts, 0);
    const correct    = sl.reduce((a, s) => a + s.correct_count,  0);
    const accuracy   = attempts === 0 ? 0 : Math.round((correct / attempts) * 100);
    const band       = toBand(accuracy);
    const weakCount  = sl.filter(s => s.accuracy_rate < 60).length;
    const meta       = SKILL_META[skill] ?? SKILL_META.default;
    return { skill, accuracy, band, attempts, weakCount, meta };
  });

  // Overall
  const totalAttempts = stats.reduce((a, s) => a + s.total_attempts, 0);
  const totalCorrect  = stats.reduce((a, s) => a + s.correct_count,  0);
  const overallAcc    = totalAttempts === 0 ? 0 : Math.round((totalCorrect / totalAttempts) * 100);
  const overallBand   = toBand(overallAcc);
  const obc           = bandColor(overallBand);

  // Filtered exams (실제 시드 데이터)
  const displayExams = activeSkill === 'ALL'
    ? exams
    : exams.filter(e => e.skill === activeSkill);

  // 기본 시험 진입점 (empty-state / 미리보기 CTA) — 첫 객관식 시험 또는 일반 진단
  const defaultExamHref =
    exams.find(e => e.kind === 'OBJECTIVE')?.href ?? `/student/diagnostic?category=${categoryId}`;

  return (
    <div className="space-y-10">

      {/* ── 헤더 ── */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-1">
            {category.title}
          </p>
          <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">언어 학습 대시보드</h1>
          <p className="text-sm text-slate-400 mt-1">실전 모의고사와 영역별 취약점을 집중 관리하세요.</p>
        </div>
        <Link href={`/student/dashboard?category=${categoryId}`}
          className="text-sm font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors">
          ← 전체 대시보드
        </Link>
      </div>

      {/* ── Overall Band Score 카드 ── */}
      <div className={`rounded-2xl p-6 text-white shadow-lg
                       ${totalAttempts > 0
                         ? 'bg-gradient-to-br from-indigo-600 to-violet-600'
                         : 'bg-gradient-to-br from-slate-600 to-slate-700'}`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-indigo-200 text-xs font-semibold uppercase tracking-widest mb-1">
              Estimated Overall Band Score
            </p>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-7xl font-black tracking-tight tabular-nums">
                {totalAttempts > 0 ? overallBand.toFixed(1) : '—'}
              </span>
              <span className="text-indigo-300 text-xl pb-3">/ 9.0</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-4">
            <p className="text-indigo-200 text-xs">정답률 기반 추정 점수</p>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold">{totalAttempts}</p>
                <p className="text-indigo-300 text-xs mt-0.5">총 풀이</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">{overallAcc}%</p>
                <p className="text-indigo-300 text-xs mt-0.5">정답률</p>
              </div>
            </div>
          </div>
        </div>
        {/* 진행 바 */}
        <div className="mt-5">
          <div className="w-full bg-white/20 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all duration-1000 ${totalAttempts > 0 ? 'bg-white' : 'bg-white/20'}`}
              style={{ width: totalAttempts > 0 ? `${(overallBand / 9) * 100}%` : '0%' }}
            />
          </div>
          <div className="flex justify-between text-xs text-indigo-300 mt-1.5">
            <span>Band 1</span><span>Band 5</span><span>Band 9</span>
          </div>
        </div>
      </div>

      {/* ── 영역별 Band Score 프로그레스 바 ── */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4">📊 영역별 예상 Band Score</h2>
        {skillSummaries.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {skillSummaries.map(({ skill, accuracy, band, attempts, weakCount, meta }) => {
              const bc = bandColor(band);
              return (
                <div key={skill}
                  className={`rounded-2xl border p-5 ${meta.bg} ${meta.border}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{meta.icon}</span>
                      <div>
                        <p className="font-bold text-slate-800 leading-tight">{skill}</p>
                        <p className="text-xs text-slate-400">{attempts}문항 풀이</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-3xl font-black tabular-nums ${bc.text}`}>
                        {attempts > 0 ? band.toFixed(1) : '—'}
                      </span>
                      {attempts > 0 && <span className="text-xs text-slate-400 ml-0.5">/ 9</span>}
                    </div>
                  </div>

                  {/* 프로그레스 바 */}
                  <div className="w-full bg-white/70 rounded-full h-2 mb-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-700 ${bc.bar}`}
                      style={{ width: attempts > 0 ? `${(band / 9) * 100}%` : '0%' }}
                    />
                  </div>

                  <div className="flex justify-between text-xs text-slate-500">
                    <span>정답률 {attempts > 0 ? `${accuracy}%` : '—'}</span>
                    {weakCount > 0 && (
                      <span className="text-rose-500 font-medium">취약 {weakCount}단원</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-10 text-center">
            <p className="text-slate-400 text-sm">진단 평가를 완료하면 영역별 점수가 표시됩니다.</p>
            <Link href={defaultExamHref}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                         bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">
              진단 평가 시작하기 →
            </Link>
          </div>
        )}
      </div>

      {/* ── 스킬 탭 + 실전 모의고사 카드 그리드 ── */}
      <div>
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h2 className="text-lg font-bold text-slate-900">🎯 실전 모의고사</h2>
          {/* 스킬 필터 탭 */}
          <div className="flex gap-1.5 flex-wrap">
            {['ALL', 'Listening', 'Reading', 'Writing', 'Speaking'].map(skill => {
              const m   = SKILL_META[skill];
              const act = activeSkill === skill;
              return (
                <button key={skill} onClick={() => setActiveSkill(skill)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200
                    ${act
                      ? skill === 'ALL'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : `${m.bg} ${m.color} border-2 ${m.border} shadow-sm`
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  {skill === 'ALL' ? 'ALL' : `${m?.icon} ${skill}`}
                </button>
              );
            })}
          </div>
        </div>

        {displayExams.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-10 text-center">
            <p className="text-slate-400 text-sm">이 영역에 준비된 모의고사가 아직 없습니다.</p>
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayExams.map(exam => {
            const meta    = SKILL_META[exam.skill] ?? SKILL_META.default;
            const isEssay = exam.kind === 'ESSAY';
            return (
              <div key={exam.id}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3
                           hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
                {/* 헤더 */}
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${meta.bg} ${meta.color}`}>
                    {meta.icon} {exam.skill}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg
                    ${isEssay ? 'text-amber-600 bg-amber-50 border border-amber-200'
                              : 'text-emerald-600 bg-emerald-50 border border-emerald-200'}`}>
                    {isEssay ? 'AI 첨삭' : '객관식'}
                  </span>
                </div>

                {/* 제목 */}
                <p className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors leading-snug flex-1">
                  {exam.title}
                </p>

                {/* 메타 */}
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>{isEssay ? '✍️ 에세이 1문항' : `📋 ${exam.questionCount}문항`}</span>
                </div>

                {/* CTA */}
                <Link href={exam.href}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl
                             text-xs font-semibold bg-slate-900 text-white
                             hover:bg-indigo-600 transition-colors duration-200">
                  {isEssay ? '시험 시작 (AI 첨삭) →' : '시험 시작 →'}
                </Link>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* ── 실전 시험 환경 (2열 그리드) ── */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-5">📄 실전 시험 환경 — Reading · Writing</h2>

        <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-md">
          {/* 상단 툴바 */}
          <div className="flex items-center justify-between bg-slate-900 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500" />
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
              </div>
              <span className="text-white font-semibold text-sm ml-2">
                {category.title} Academic — Reading Practice
              </span>
              <span className="bg-emerald-500 text-white text-xs px-2.5 py-0.5 rounded-full font-medium">
                진행 중
              </span>
            </div>
            <div className="flex items-center gap-4 text-slate-300 text-sm">
              <span className="font-mono">⏱ 57:42</span>
              <span>Q 1 / 13</span>
            </div>
          </div>

          {/* 2열 메인 그리드 */}
          <div className="grid grid-cols-1 lg:grid-cols-2" style={{ minHeight: '420px' }}>

            {/* ── 좌: 지문 영역 ── */}
            <div className="border-r border-slate-200 bg-white p-7 overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Passage 1</span>
                <button className="text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors">
                  Highlight
                </button>
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-4 leading-snug">
                The Global Rise of Remote Work
              </h3>
              <div className="space-y-4 text-sm text-slate-600 leading-7">
                <p>
                  <span className="font-bold text-indigo-600 mr-1">[A]</span>
                  The widespread adoption of remote work has fundamentally altered urban planning
                  priorities across major cities worldwide. Planners who once designed neighbourhoods
                  around daily commutes are now rethinking mixed-use zones and public transit corridors.
                </p>
                <p>
                  <span className="font-bold text-indigo-600 mr-1">[B]</span>
                  Infrastructure investment has shifted markedly as a consequence. Demand for
                  high-speed broadband has outpaced all projections, with analysts noting a 340%
                  increase in residential bandwidth requirements since 2020.
                </p>
                <p>
                  <span className="font-bold text-indigo-600 mr-1">[C]</span>
                  Housing markets in secondary cities have experienced unprecedented pressure as
                  knowledge workers, freed from fixed office locations, seek larger living spaces
                  at lower costs.
                </p>
                <p className="text-slate-400 italic text-xs border-t border-slate-100 pt-3">
                  — 실전 모의고사에서 전체 지문이 표시됩니다 —
                </p>
              </div>
            </div>

            {/* ── 우: 답안 입력 영역 ── */}
            <div className="bg-slate-50 p-7">
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Questions 1–5 · Matching Headings
                </span>
                <span className="text-xs text-slate-400">1 answered</span>
              </div>
              <p className="text-sm text-slate-600 mb-5 leading-relaxed">
                The passage has <strong>7 paragraphs, A–G</strong>. Choose the correct heading for
                paragraphs A–E from the list of headings below. Write the correct number, <strong>i–ix</strong>, next to each question.
              </p>

              <div className="space-y-3 mb-6">
                {[
                  { para: 'A', answer: 'iii. Remote work and urban transformation', filled: true },
                  { para: 'B', answer: '답을 선택하세요…', filled: false },
                  { para: 'C', answer: '답을 선택하세요…', filled: false },
                ].map(({ para, answer, filled }) => (
                  <div key={para} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center
                                    justify-center text-xs font-bold text-slate-500 shrink-0">
                      {para}
                    </div>
                    <div className={`flex-1 h-10 rounded-xl border-2 flex items-center px-3 text-xs
                                    transition-colors cursor-pointer
                      ${filled
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-700 font-medium'
                        : 'border-slate-200 bg-white text-slate-400 hover:border-indigo-300'}`}>
                      {answer}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-slate-400 italic pt-1">
                  — 실전 모의고사에서 전체 문항이 활성화됩니다 —
                </p>
              </div>

              <Link href={defaultExamHref}
                className="w-full inline-flex items-center justify-center gap-2
                           py-3.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold
                           hover:bg-indigo-700 transition-colors shadow-sm">
                🚀 실전 모의고사 바로 시작하기
              </Link>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
