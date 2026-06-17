'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createClient } from '@/lib/supabase/client';
import { difficultyStyle } from '@/lib/difficulty';
import {
  RotateCcw, CheckCircle2, Calendar, AlertTriangle,
  NotebookPen, ChevronRight, Sparkles, Send, X, MessageCircleQuestion,
} from 'lucide-react';
import type { CategoryType, QuestionType, QuestionOptions } from '@/types';

// ── 보관함 1행(문항 단위) ────────────────────────────────────
export interface IncorrectItem {
  questionId:      string;
  chapterId:       string;
  questionType:    QuestionType;
  questionText:    string;
  options:         QuestionOptions | null;
  answer:          string;
  difficulty:      string;
  explanation:     string | null;
  passage:         string | null;
  level_1:         string;
  level_2:         string;
  categoryId:      string;
  categoryType:    CategoryType;
  categoryTitle:   string;
  lastWrongAnswer: string;
  lastWrongAt:     string;
  wrongCount:      number;
}

// ── 마크다운 렌더러 ──────────────────────────────────────────
function MD({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="text-lg font-bold text-slate-800 mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-bold text-slate-700 mb-2">{children}</h2>,
        p:  ({ children }) => <p className="text-sm text-slate-700 leading-7 mb-2">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
        ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2 text-sm text-slate-700">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2 text-sm text-slate-700">{children}</ol>,
        li: ({ children }) => <li className="leading-6">{children}</li>,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

const nl = (s: string) => s.replace(/\\n/g, '\n');
const eq = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();

type RetryResult = 'idle' | 'correct' | 'wrong';

/* items 는 서버에서 활성 도메인(sm_domain)으로 이미 격리되어 전달된다 → 도메인 탭 불필요 */
export function IncorrectNotebook({ items: initialItems }: { items: IncorrectItem[] }) {
  const supabase = createClient();

  const [items,      setItems]      = useState<IncorrectItem[]>(initialItems);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [toast,      setToast]      = useState<string | null>(null);

  // 선생님께 질문하기(1:1 튜터 Q&A) 상태
  const [askItem, setAskItem] = useState<IncorrectItem | null>(null);
  const [askText, setAskText] = useState('');
  const [asking,  setAsking]  = useState(false);

  // 재도전(미니 퀴즈) 상태
  const [quizMode,   setQuizMode]   = useState(false);
  const [quizAnswer, setQuizAnswer] = useState('');
  const [quizPhase,  setQuizPhase]  = useState<'idle' | 'grading'>('idle');
  const [quizResult, setQuizResult] = useState<RetryResult>('idle');

  const visible  = items;
  const selected = items.find((it) => it.questionId === selectedId) ?? null;

  const pickCard = (id: string) => {
    setSelectedId(id);
    setQuizMode(false);
    setQuizAnswer('');
    setQuizResult('idle');
    setQuizPhase('idle');
  };

  const enterQuiz = () => {
    setQuizMode(true);
    setQuizAnswer('');
    setQuizResult('idle');
    setQuizPhase('idle');
  };

  // ── 오답 지우개: 재도전 채점 (기존 /api/grade 로직 재사용) ──
  const submitRetry = async () => {
    if (!selected || !quizAnswer.trim()) return;
    setQuizPhase('grading');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setQuizPhase('idle'); return; }

    // 복습용 단일 문항 세션 (INFINITE_TRAINING) — 정답 시 weakness_stats 가 자연 갱신됨
    const { data: sess } = await supabase
      .from('study_sessions')
      .insert({
        user_id:      user.id,
        category_id:  selected.categoryId,
        session_type: 'INFINITE_TRAINING',
        config:       { limit_type: 'COUNT', limit_value: 1, chapter_ids: [selected.chapterId] },
        status:       'IN_PROGRESS',
      })
      .select()
      .single();

    if (!sess) { setQuizPhase('idle'); return; }

    try {
      const res = await fetch('/api/grade', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sess.id,
          attempts: [{ question_id: selected.questionId, user_answer: quizAnswer.trim(), elapsed_time: 0 }],
        }),
      });
      if (!res.ok) throw new Error('grade failed');
      const { correct_count } = await res.json();
      setQuizPhase('idle');

      if (correct_count === 1) {
        // ── 정복! 토스트 + 카드 클리어 애니메이션 ──
        setQuizResult('correct');
        setToast('오답 정복 완료! 취약점이 보완되었습니다.');
        const target = selected.questionId;
        setClearingId(target);
        setTimeout(() => {
          setItems((prev) => prev.filter((it) => it.questionId !== target));
          setClearingId(null);
          setSelectedId(null);
          setQuizMode(false);
        }, 600);
        setTimeout(() => setToast(null), 3200);
      } else {
        // ── 또 틀림: 누적 오답 +1, 재시도 유도 ──
        setQuizResult('wrong');
        setItems((prev) =>
          prev.map((it) =>
            it.questionId === selected.questionId
              ? { ...it, wrongCount: it.wrongCount + 1, lastWrongAnswer: quizAnswer.trim() }
              : it,
          ),
        );
      }
    } catch {
      setQuizPhase('idle');
      setQuizResult('idle');
    }
  };

  // ── 선생님께 질문하기: 오답 컨텍스트(문항+선지+정답+내 오답+AI해설)를 묶어 DB 저장 ──
  const submitQuestion = async () => {
    if (!askItem || !askText.trim()) return;
    setAsking(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAsking(false); return; }

    // 담당 튜터 자동 배정(매핑된 첫 튜터, 없으면 미배정 NULL)
    const { data: map } = await supabase
      .from('tutor_students')
      .select('tutor_id')
      .eq('student_id', user.id)
      .limit(1)
      .maybeSingle();

    const wrongContext = {
      question_text:     askItem.questionText,
      options:           askItem.options,
      correct_answer:    askItem.answer,
      user_wrong_answer: askItem.lastWrongAnswer,
      level_1:           askItem.level_1,
      level_2:           askItem.level_2,
      category_title:    askItem.categoryTitle,
      difficulty:        askItem.difficulty,
    };

    const { data: q, error } = await supabase
      .from('tutor_questions')
      .insert({
        student_id:    user.id,
        tutor_id:      map?.tutor_id ?? null,
        question_id:   askItem.questionId,
        wrong_context: wrongContext,
        ai_analysis:   askItem.explanation ?? null,
      })
      .select('id')
      .single();

    if (error || !q) {
      setAsking(false);
      setToast('질문 전송 실패: ' + (error?.message ?? ''));
      setTimeout(() => setToast(null), 3200);
      return;
    }

    // 첫 학생 메시지(student_message)를 스레드에 적재
    await supabase.from('tutor_messages').insert({
      question_id: q.id,
      sender_id:   user.id,
      sender_role: 'student',
      body:        askText.trim(),
    });

    setAsking(false);
    setAskItem(null);
    setAskText('');
    setToast('선생님께 질문이 전송되었습니다! 답변이 등록되면 알려드릴게요.');
    setTimeout(() => setToast(null), 3200);
  };

  const diffColor = (d: string) => difficultyStyle(d).badge;

  return (
    <div className="space-y-6">
      {/* ── 헤더 ── */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-1">
            <NotebookPen size={13} /> My Review Vault
          </p>
          <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">나의 오답노트</h1>
          <p className="text-sm text-slate-400 mt-1">
            다시 풀어 맞히면 보관함에서 자동으로 사라집니다. 약점을 하나씩 정복하세요.
          </p>
        </div>
        <span className="text-sm font-semibold text-slate-500 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
          남은 오답 <span className="text-rose-500 font-bold">{items.length}</span>개
        </span>
      </div>

      {/* ── 2열 스플릿: 좌 40% 리스트 / 우 60% 상세 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[40%_1fr] gap-5 h-[calc(100vh-17rem)]">

        {/* ══ 좌측: 오답 카드 리스트 ══ */}
        <div className="overflow-y-auto pr-1 space-y-3">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-slate-400">
              <CheckCircle2 size={40} className="text-emerald-400" />
              <p className="text-sm font-medium">이 영역의 오답이 없습니다.</p>
              <p className="text-xs">모두 정복했거나 아직 응시 기록이 없어요.</p>
            </div>
          ) : (
            visible.map((it) => {
              const isSel    = it.questionId === selectedId;
              const clearing = it.questionId === clearingId;
              return (
                <button
                  key={it.questionId}
                  onClick={() => pickCard(it.questionId)}
                  className={`w-full text-left rounded-2xl border bg-white px-4 py-4 transition-all duration-500 overflow-hidden
                    ${clearing ? 'opacity-0 -translate-x-6 max-h-0 py-0 mb-0 border-transparent' : 'max-h-60'}
                    ${isSel
                      ? 'border-indigo-400 shadow-md ring-2 ring-indigo-100'
                      : 'border-slate-100 shadow-sm hover:border-indigo-200 hover:shadow-md'}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${diffColor(it.difficulty)}`}>
                      {it.difficulty}
                    </span>
                    <span className="text-xs font-medium text-slate-400 truncate">
                      {it.level_1} › {it.level_2}
                    </span>
                    <ChevronRight size={14} className={`ml-auto flex-none ${isSel ? 'text-indigo-500' : 'text-slate-300'}`} />
                  </div>
                  <p className="text-sm text-slate-700 font-medium leading-6 line-clamp-2">
                    {nl(it.questionText).replace(/[#*`>]/g, '').slice(0, 90)}
                  </p>
                  <div className="flex items-center gap-3 mt-2.5 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar size={11} /> {new Date(it.lastWrongAt).toLocaleDateString('ko-KR')}
                    </span>
                    <span className="flex items-center gap-1 text-rose-500 font-semibold">
                      <AlertTriangle size={11} /> 누적 오답 {it.wrongCount}회
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* ══ 우측: 상세 복습 / 재도전 ══ */}
        <div className="overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-slate-300 px-8">
              <NotebookPen size={44} />
              <p className="text-sm font-medium text-slate-400">왼쪽에서 복습할 오답을 선택하세요.</p>
            </div>
          ) : (
            <DetailPanel
              key={selected.questionId}
              item={selected}
              quizMode={quizMode}
              quizAnswer={quizAnswer}
              quizPhase={quizPhase}
              quizResult={quizResult}
              onEnterQuiz={enterQuiz}
              onPickAnswer={(v) => { setQuizAnswer(v); setQuizResult('idle'); }}
              onSubmit={submitRetry}
              onCancelQuiz={() => { setQuizMode(false); setQuizResult('idle'); }}
              onAskTutor={() => { setAskItem(selected); setAskText(''); }}
              diffColor={diffColor}
            />
          )}
        </div>
      </div>

      {/* ── 선생님께 질문하기 모달 ── */}
      {askItem && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 px-4 py-6 backdrop-blur-sm sm:items-center"
          onClick={() => !asking && setAskItem(null)}
        >
          <div
            className="relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => !asking && setAskItem(null)}
              aria-label="닫기"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
            >
              <X size={16} />
            </button>

            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-indigo-500">
              <MessageCircleQuestion size={14} /> 1:1 선생님 질문
            </p>
            <h3 className="mt-1 text-lg font-extrabold text-slate-900">이해가 안 되는 부분을 적어주세요</h3>

            {/* 자동 첨부되는 컨텍스트 요약 */}
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                자동 첨부 — 문제·내 오답·AI 해설
              </p>
              <p className="text-xs font-medium text-slate-500">
                {askItem.level_1} › {askItem.level_2} · 난이도 {askItem.difficulty}
              </p>
              <p className="mt-1.5 line-clamp-2 text-sm text-slate-700">
                {nl(askItem.questionText).replace(/[#*`>]/g, '').slice(0, 120)}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-600">
                  내 오답: {askItem.lastWrongAnswer || '(미답)'}
                </span>
                <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700">
                  정답: {askItem.answer}
                </span>
              </div>
            </div>

            <textarea
              value={askText}
              onChange={(e) => setAskText(e.target.value)}
              rows={4}
              placeholder="예) 정답이 왜 C인지 모르겠어요. 2번 보기와의 차이가 헷갈립니다."
              className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm
                         focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />

            <div className="mt-4 flex gap-2.5">
              <button
                onClick={submitQuestion}
                disabled={asking || !askText.trim()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3
                           text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                <Send size={15} /> {asking ? '전송 중…' : '선생님께 보내기'}
              </button>
              <button
                onClick={() => !asking && setAskItem(null)}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 초록 토스트 ── */}
      {toast && (
        <div className="toast-in fixed bottom-6 left-1/2 -translate-x-1/2 z-50
                        flex items-center gap-2.5 bg-emerald-600 text-white
                        px-5 py-3.5 rounded-2xl shadow-2xl shadow-emerald-900/20">
          <CheckCircle2 size={20} />
          <span className="text-sm font-bold">{toast}</span>
        </div>
      )}
    </div>
  );
}

// ── 우측 상세 패널 ───────────────────────────────────────────
function DetailPanel({
  item, quizMode, quizAnswer, quizPhase, quizResult,
  onEnterQuiz, onPickAnswer, onSubmit, onCancelQuiz, onAskTutor, diffColor,
}: {
  item:         IncorrectItem;
  quizMode:     boolean;
  quizAnswer:   string;
  quizPhase:    'idle' | 'grading';
  quizResult:   RetryResult;
  onEnterQuiz:  () => void;
  onPickAnswer: (v: string) => void;
  onSubmit:     () => void;
  onCancelQuiz: () => void;
  onAskTutor:   () => void;
  diffColor:    (d: string) => string;
}) {
  const optionKeys = item.options ? Object.keys(item.options) : [];
  const isObjective = item.questionType !== 'SHORT_ANSWER' && !!item.options;
  const passage = item.passage ? nl(item.passage) : '';

  return (
    <div className="flex flex-col h-full">
      {/* 좌측 고정 지문 (있을 경우) */}
      {passage && (
        <div className="flex-none max-h-[38%] overflow-y-auto border-b border-slate-100 bg-slate-50/70 px-6 py-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Passage</p>
          <MD>{passage}</MD>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {/* 메타 */}
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${diffColor(item.difficulty)}`}>
            {item.difficulty}
          </span>
          <span className="text-xs font-medium text-slate-400">{item.level_1} › {item.level_2}</span>
          <span className="ml-auto flex items-center gap-1 text-xs text-rose-500 font-semibold">
            <AlertTriangle size={12} /> 누적 {item.wrongCount}회
          </span>
        </div>

        {/* 문제 본문 */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
          <MD>{nl(item.questionText)}</MD>
        </div>

        {/* ── 재도전 미니 퀴즈 모드 ── */}
        {quizMode ? (
          <div className="space-y-3">
            <p className="text-sm font-bold text-indigo-600 flex items-center gap-1.5">
              <RotateCcw size={15} /> 다시 풀기 — 정답을 선택하고 제출하세요
            </p>

            {isObjective ? (
              <div className="space-y-2.5">
                {optionKeys.map((key) => {
                  const optVal = (item.options as unknown as Record<string, string>)[key];
                  const sel = quizAnswer === key;
                  return (
                    <button
                      key={key}
                      onClick={() => onPickAnswer(key)}
                      disabled={quizPhase === 'grading'}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-sm flex items-start gap-3 transition-all
                        ${sel
                          ? 'border-indigo-400 bg-indigo-50 text-indigo-900 font-medium shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-slate-50'}`}
                    >
                      <span className={`w-6 h-6 flex-none rounded-lg text-xs font-bold flex items-center justify-center mt-0.5
                        ${sel ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
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
                value={quizAnswer}
                onChange={(e) => onPickAnswer(e.target.value)}
                disabled={quizPhase === 'grading'}
                placeholder="정답을 입력하세요"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm
                           focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            )}

            {quizResult === 'wrong' && (
              <p className="text-sm font-semibold text-rose-500 flex items-center gap-1.5">
                <AlertTriangle size={14} /> 아쉽게도 또 틀렸어요. 해설을 다시 보고 도전해 보세요.
              </p>
            )}

            <div className="flex gap-2.5 pt-1">
              <button
                onClick={onSubmit}
                disabled={quizPhase === 'grading' || !quizAnswer.trim()}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl
                           bg-indigo-600 text-white text-sm font-semibold
                           hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {quizPhase === 'grading' ? '채점 중…' : <><Send size={15} /> 제출하고 채점</>}
              </button>
              <button
                onClick={onCancelQuiz}
                disabled={quizPhase === 'grading'}
                className="px-5 py-3 rounded-xl border border-slate-200 text-slate-500 text-sm font-semibold hover:bg-slate-50"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ── 선지 + 정오답 대조 ── */}
            {isObjective ? (
              <div className="space-y-2.5">
                {optionKeys.map((key) => {
                  const optVal     = (item.options as unknown as Record<string, string>)[key];
                  const isCorrect  = eq(key, item.answer);
                  const isMyWrong  = eq(key, item.lastWrongAnswer) && !isCorrect;
                  return (
                    <div key={key}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-sm flex items-start gap-3
                        ${isCorrect ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                          : isMyWrong ? 'border-rose-300 bg-rose-50 text-rose-900'
                          : 'border-slate-200 bg-white text-slate-400'}`}>
                      <span className={`w-6 h-6 flex-none rounded-lg text-xs font-bold flex items-center justify-center mt-0.5
                        ${isCorrect ? 'bg-emerald-500 text-white'
                          : isMyWrong ? 'bg-rose-500 text-white'
                          : 'bg-slate-100 text-slate-500'}`}>
                        {key}
                      </span>
                      <span className="flex-1">{optVal}</span>
                      {isCorrect && <span className="text-emerald-600 text-xs font-bold whitespace-nowrap">정답 ✓</span>}
                      {isMyWrong && <span className="text-rose-500 text-xs font-bold whitespace-nowrap">내 오답 ✕</span>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="px-4 py-3 rounded-xl border border-rose-300 bg-rose-50 text-sm">
                  <p className="text-xs text-slate-500 mb-0.5">내가 썼던 답</p>
                  <p className="font-medium text-rose-700">{item.lastWrongAnswer || '(미답)'}</p>
                </div>
                <div className="px-4 py-3 rounded-xl border border-emerald-300 bg-emerald-50 text-sm">
                  <p className="text-xs text-slate-500 mb-0.5">정답</p>
                  <p className="font-medium text-emerald-800">{item.answer}</p>
                </div>
              </div>
            )}

            {/* ── 인디고 해설 카드 ── */}
            {item.explanation && (
              <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-white p-5">
                <p className="flex items-center gap-1.5 text-sm font-bold text-indigo-700 mb-2">
                  <Sparkles size={15} /> 해설
                </p>
                <MD>{nl(item.explanation)}</MD>
              </div>
            )}

            {/* ── 오답 지우개 버튼 ── */}
            <button
              onClick={onEnterQuiz}
              className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl
                         bg-slate-900 text-white text-sm font-semibold
                         hover:bg-indigo-600 transition-colors duration-200"
            >
              <RotateCcw size={16} /> 이 문항 다시 풀기
            </button>

            {/* ── 이해가 안 돼요? 선생님께 질문하기 (1:1 튜터 Q&A) ── */}
            <button
              onClick={onAskTutor}
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl
                         border border-indigo-200 bg-indigo-50/60 text-indigo-700 text-sm font-semibold
                         hover:bg-indigo-100 transition-colors duration-200"
            >
              <MessageCircleQuestion size={16} /> 이해가 안 돼요? 선생님께 질문하기
            </button>
          </>
        )}
      </div>
    </div>
  );
}
