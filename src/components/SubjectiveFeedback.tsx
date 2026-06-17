'use client';

import { useState } from 'react';
import { ChevronDown, Sparkles, PenLine, Wand2, ArrowRight } from 'lucide-react';
import type { SubjectiveExamType, SubjectiveFeedback } from '@/types';

interface Props {
  feedback:  SubjectiveFeedback;
  examType?: SubjectiveExamType;
}

export function SubjectiveFeedback({ feedback, examType = 'IELTS' }: Props) {
  const [open, setOpen] = useState<number | null>(0);

  const isDelf        = examType === 'DELF';
  const overallMax    = isDelf ? 100 : 9;
  const criterionMax  = isDelf ? 25  : 9;
  const overallPct    = Math.min(100, (feedback.overall_score / overallMax) * 100);
  const criteria      = Object.entries(feedback.criteria ?? {});

  return (
    <div className="space-y-8">

      {/* ── 상단: Overall Score 대형 배지 ── */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-6 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-indigo-200 text-xs font-semibold uppercase tracking-widest mb-1">
              <Sparkles size={13} /> AI Estimated Score · {examType}
            </p>
            <div className="flex items-end gap-2">
              <span className="text-6xl font-black tracking-tight tabular-nums leading-none">
                {feedback.overall_score}
              </span>
              <span className="text-indigo-300 text-lg pb-1.5">/ {overallMax}</span>
            </div>
          </div>
          <div className="text-right text-xs text-indigo-200 max-w-[180px]">
            공식 {examType} 채점 기준에 따른 AI 예상 점수입니다.
          </div>
        </div>

        <div className="mt-5 w-full bg-white/20 rounded-full h-2.5">
          <div
            className="h-2.5 rounded-full bg-white transition-all duration-1000"
            style={{ width: `${overallPct}%` }}
          />
        </div>
      </div>

      {/* ── 영역별 스킬 프로그레스 바 ── */}
      {criteria.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {criteria.map(([name, c]) => {
            const pct = Math.min(100, (c.score / criterionMax) * 100);
            return (
              <div key={name} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-slate-800 text-sm leading-tight pr-2">{name}</p>
                  <span className="text-xl font-black text-indigo-600 tabular-nums shrink-0">
                    {c.score}
                    <span className="text-xs text-slate-400 font-medium ml-0.5">/ {criterionMax}</span>
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2.5">
                  <div
                    className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 leading-5">{c.comment}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 본문 첨삭: 빨간 취소선(Original) + 초록 밑줄(Corrected) + 아코디언 ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <PenLine className="text-indigo-500" size={18} />
          <h2 className="text-lg font-bold text-slate-900">실전 첨삭 오답노트</h2>
          <span className="ml-auto text-xs text-slate-400">{feedback.corrections.length}개 문장 교정</span>
        </div>

        <div className="space-y-3">
          {feedback.corrections.map((c, i) => {
            const isOpen = open === i;
            return (
              <div
                key={i}
                className={`rounded-2xl border bg-white overflow-hidden transition-colors
                  ${isOpen ? 'border-indigo-300 shadow-sm' : 'border-slate-100'}`}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full text-left px-5 py-4 flex flex-col gap-1.5"
                >
                  {/* 빨간 취소선 — 원문 */}
                  <span className="text-sm text-rose-500 line-through decoration-rose-400/70 decoration-1 leading-6">
                    {c.original}
                  </span>
                  {/* 초록 밑줄 — 교정문 */}
                  <span className="text-sm text-emerald-700 font-medium underline decoration-emerald-400 decoration-2 underline-offset-4 leading-6">
                    {c.corrected}
                  </span>

                  <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-indigo-500">
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                    {isOpen ? '교정 이유 닫기' : 'AI 교정 이유 보기'}
                  </span>
                </button>

                {/* 아코디언 — 한글 교정 이유 */}
                {isOpen && (
                  <div className="px-5 pb-5 pt-1">
                    <div className="rounded-xl bg-indigo-50/70 border border-indigo-100 px-4 py-3">
                      <p className="text-xs font-semibold text-indigo-700 mb-1">왜 이렇게 고쳐야 하나요?</p>
                      <p className="text-sm text-slate-700 leading-6">{c.rationale}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 프리미엄 어휘 추천 (Vocabulary Enhancement) ── */}
      {feedback.vocabulary && feedback.vocabulary.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Wand2 className="text-indigo-500" size={18} />
            <h2 className="text-lg font-bold text-slate-900">프리미엄 어휘 추천</h2>
            <span className="ml-auto text-xs text-slate-400">{feedback.vocabulary.length}개 업그레이드</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {feedback.vocabulary.map((v, i) => (
              <div key={i} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-400 line-through decoration-slate-300">{v.original}</span>
                  <ArrowRight size={14} className="text-indigo-400 shrink-0" />
                  <span className="font-bold text-emerald-700">{v.upgrade}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">{v.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 실전 오답노트 총평 (general_feedback) ── */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-indigo-50/40 p-6">
        <p className="flex items-center gap-1.5 text-sm font-bold text-slate-800 mb-2">
          <Sparkles className="text-indigo-500" size={15} /> AI 총평
        </p>
        <p className="text-sm text-slate-700 leading-7 whitespace-pre-line">
          {feedback.general_feedback}
        </p>
      </div>
    </div>
  );
}
