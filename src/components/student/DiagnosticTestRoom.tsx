'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createClient } from '@/lib/supabase/client';
import { useTimer } from '@/hooks/useTimer';
import { useSessionStore } from '@/stores/sessionStore';
import { CheckCircle2, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import type { UniversalQuestion, StudySession } from '@/types';

// ── 마크다운 렌더러 ────────────────────────────────────────
function MD({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-xl font-bold text-slate-800 mb-3">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-bold text-slate-700 mb-2 pb-1 border-b border-slate-100">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold text-slate-700 mb-1">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="text-sm text-slate-700 leading-7 mb-3">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-slate-900">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-slate-600">{children}</em>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside space-y-1 mb-3 text-sm text-slate-700">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside space-y-1 mb-3 text-sm text-slate-700">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="leading-6">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-indigo-200 pl-4 my-3 text-slate-500 italic text-sm">
            {children}
          </blockquote>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

// ── 지문 / 질문 분리 ──────────────────────────────────────
// DB에 저장된 literal \n 을 실제 개행으로 변환한 뒤 이중개행(\n\n)으로 단락을 나눈다.
// 번호가 매겨진 굵은 문항 지시문("**1.", "**3.")을 기준으로 그 앞 단락 전체를 지문으로,
// 지시문부터 끝까지(단답형의 빈칸 문장 포함)를 질문으로 분리한다.
function splitContent(raw: string): { passage: string; question: string } {
  const text = raw.replace(/\\n/g, '\n').trim();
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  if (paras.length <= 1) return { passage: '', question: text };

  // 1순위: "**N." 형태의 번호 매겨진 문항 지시문 단락
  let qIdx = paras.findIndex((p) => /^\*\*\s*\d+[.).]/.test(p));

  // 2순위: 마지막 단락이 질문 형태(**…** 또는 ?로 끝남)인 경우
  if (qIdx === -1) {
    const last = paras[paras.length - 1];
    const lastIsQuestion = last.startsWith('**') || /\?\**$/.test(last);
    qIdx = lastIsQuestion ? paras.length - 1 : -1;
  }

  // 지문이 질문 앞에 실제로 존재할 때만 분리
  if (qIdx > 0) {
    return {
      passage: paras.slice(0, qIdx).join('\n\n'),
      question: paras.slice(qIdx).join('\n\n'),
    };
  }
  return { passage: '', question: text };
}

// ── 타이머 표시 ────────────────────────────────────────────
function LiveTimer({ questionId, getElapsed }: { questionId: string; getElapsed: (id: string) => number }) {
  const [secs, setSecs] = useState(() => getElapsed(questionId));
  useEffect(() => {
    const id = setInterval(() => setSecs(getElapsed(questionId)), 1000);
    return () => clearInterval(id);
  }, [questionId, getElapsed]);
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  return (
    <span className="flex items-center gap-1 text-xs font-mono text-slate-400">
      <Clock size={12} /> {mm}:{ss}
    </span>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────
interface DiagnosticTestRoomProps {
  session: StudySession;
  questions: UniversalQuestion[];
  onComplete: () => void;
}

export function DiagnosticTestRoom({ session, questions, onComplete }: DiagnosticTestRoomProps) {
  const supabase = createClient();
  const { saveDraft, getDraft, clearDraft } = useSessionStore();

  const draft = getDraft(session.id);
  const [currentIdx,   setCurrentIdx]   = useState(draft?.currentIdx ?? 0);
  const [answers,      setAnswers]       = useState<Record<string, string>>(draft?.answers ?? {});
  const [isSubmitting, setIsSubmitting]  = useState(false);
  const [submitted,    setSubmitted]     = useState(false);
  const [result,       setResult]        = useState<{ correct: number; total: number } | null>(null);

  const questionIds = questions.map((q) => q.id);
  const { getElapsed, switchQuestion, pause } = useTimer(questionIds);

  // 문항 전환 시 타이머 갱신
  useEffect(() => {
    if (questions[currentIdx]) switchQuestion(questions[currentIdx].id);
  }, [currentIdx, questions, switchQuestion]);

  // 자동 임시저장
  useEffect(() => {
    saveDraft({
      sessionId: session.id,
      answers,
      elapsedTimes: Object.fromEntries(questionIds.map((id) => [id, getElapsed(id)])),
      currentIdx,
    });
  }, [answers, currentIdx]); // eslint-disable-line

  // 이탈 방지
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const currentQ = questions[currentIdx];

  // 좌측 지문 고정(Pinned): passage 컬럼이 있는 첫 문항을 대표 지문으로 캐싱.
  // 컬럼이 없는 레거시 데이터는 question_text 안에 임베드된 지문을 추출해 폴백.
  const pinnedPassage = useMemo(() => {
    const fromCol = questions.find((q) => q.passage && q.passage.trim());
    if (fromCol?.passage) return fromCol.passage.replace(/\\n/g, '\n');
    for (const q of questions) {
      const extracted = splitContent(q.question_text).passage;
      if (extracted) return extracted;
    }
    return '';
  }, [questions]);

  // passage 컬럼을 쓰는 세트면 question_text 는 문항 본문 그대로,
  // 레거시(임베드)면 splitContent 로 지문을 떼어낸 질문만 표시.
  const hasPassageColumn = useMemo(
    () => questions.some((q) => q.passage && q.passage.trim()),
    [questions],
  );
  const question = currentQ
    ? (hasPassageColumn ? currentQ.question_text.replace(/\\n/g, '\n') : splitContent(currentQ.question_text).question)
    : '';
  const optionKeys = currentQ?.options ? Object.keys(currentQ.options) : [];

  const selectAnswer = useCallback((key: string) => {
    setAnswers((prev) => ({ ...prev, [currentQ.id]: key }));
  }, [currentQ]);

  const navigate = useCallback((idx: number) => {
    if (idx >= 0 && idx < questions.length) setCurrentIdx(idx);
  }, [questions.length]);

  const handleSubmit = async () => {
    const unanswered = questions.filter((q) => !answers[q.id]);
    if (unanswered.length > 0) {
      if (!confirm(`아직 ${unanswered.length}문항이 미답입니다. 제출하시겠습니까?`)) return;
    }
    pause();
    setIsSubmitting(true);
    try {
      const payload = questions.map((q) => ({
        question_id:  q.id,
        user_answer:  answers[q.id] ?? '',
        elapsed_time: getElapsed(q.id),
      }));
      const res = await fetch('/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id, attempts: payload }),
      });
      if (!res.ok) throw new Error('채점 실패');
      const { correct_count, total } = await res.json();
      clearDraft(session.id);
      setResult({ correct: correct_count, total });
      setSubmitted(true);
      onComplete();
    } catch {
      alert('제출 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── 결과 화면 ──
  if (submitted && result) {
    const pct = Math.round((result.correct / result.total) * 100);
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mb-2">
          <CheckCircle2 className="text-indigo-500" size={40} />
        </div>
        <p className="text-5xl font-extrabold text-indigo-600">{pct}점</p>
        <p className="text-slate-500 text-sm">{result.total}문항 중 {result.correct}문항 정답</p>
        <button
          onClick={onComplete}
          className="mt-4 px-8 py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700"
        >
          결과 확인하기
        </button>
      </div>
    );
  }

  if (!currentQ) return null;

  const diffColor =
    currentQ.difficulty === '상' ? 'bg-rose-100 text-rose-600' :
    currentQ.difficulty === '중' ? 'bg-amber-100 text-amber-600' :
                                    'bg-emerald-100 text-emerald-600';

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-slate-50">

      {/* ══ 좌측: 지문 영역 ══ */}
      <div className="w-[46%] flex-none flex flex-col border-r border-slate-200 bg-white">
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Passage</span>
        </div>
        <div className="flex-1 overflow-y-auto px-7 py-6">
          {pinnedPassage ? (
            <MD>{pinnedPassage}</MD>
          ) : (
            <p className="text-sm text-slate-400 italic">이 문항은 별도 지문 없이 단독 질문입니다.</p>
          )}
        </div>
      </div>

      {/* ══ 우측: 문제 + 선택지 영역 ══ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* 문항 번호 네비게이터 */}
        <div className="flex-none px-4 py-2.5 border-b border-slate-200 bg-white flex flex-wrap gap-1.5 items-center">
          {questions.map((q, i) => (
            <button
              key={q.id}
              onClick={() => navigate(i)}
              className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors
                ${i === currentIdx
                  ? 'bg-indigo-600 text-white'
                  : answers[q.id]
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              {i + 1}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-3 text-xs text-slate-400">
            <span>{Object.keys(answers).length} / {questions.length} 답변</span>
          </div>
        </div>

        {/* 문제 본문 */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* 문항 메타 */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-semibold text-slate-400">Q{currentIdx + 1}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${diffColor}`}>
              {currentQ.difficulty}
            </span>
            <div className="ml-auto">
              <LiveTimer questionId={currentQ.id} getElapsed={getElapsed} />
            </div>
          </div>

          {/* 질문 텍스트 */}
          <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <MD>{question}</MD>
          </div>

          {/* 선택지 or 단답 입력 */}
          {currentQ.question_type !== 'SHORT_ANSWER' && currentQ.options ? (
            <div className="space-y-2.5">
              {optionKeys.map((key) => {
                const optVal = (currentQ.options as unknown as Record<string, string>)[key];
                const selected = answers[currentQ.id] === key;
                return (
                  <button
                    key={key}
                    onClick={() => selectAnswer(key)}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm
                                transition-all duration-150 flex items-start gap-3
                      ${selected
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-900 font-medium shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-slate-50'}`}
                  >
                    <span className={`w-6 h-6 flex-none rounded-lg text-xs font-bold
                                     flex items-center justify-center mt-0.5
                      ${selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {key}
                    </span>
                    {optVal}
                  </button>
                );
              })}
            </div>
          ) : (
            <input
              type="text"
              placeholder="정답을 입력하세요"
              value={answers[currentQ.id] ?? ''}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [currentQ.id]: e.target.value }))}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm
                         focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          )}
        </div>

        {/* 하단 네비게이션 */}
        <div className="flex-none px-6 py-4 border-t border-slate-200 bg-white flex justify-between items-center">
          <button
            onClick={() => navigate(currentIdx - 1)}
            disabled={currentIdx === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200
                       text-sm text-slate-500 hover:bg-slate-50 disabled:opacity-30"
          >
            <ChevronLeft size={16} /> 이전
          </button>

          {currentIdx < questions.length - 1 ? (
            <button
              onClick={() => navigate(currentIdx + 1)}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600
                         text-white text-sm font-semibold hover:bg-indigo-700"
            >
              다음 <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-2 rounded-xl bg-emerald-600 text-white text-sm
                         font-semibold hover:bg-emerald-700 disabled:opacity-60"
            >
              {isSubmitting ? '제출 중…' : '최종 제출'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
