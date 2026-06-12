'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTimer } from '@/hooks/useTimer';
import { difficultyStyle } from '@/lib/difficulty';
import type { UniversalQuestion, StudySession, WeaknessStat } from '@/types';

interface TrainingRoomProps {
  session: StudySession;
  weakStats: WeaknessStat[];
}

type TrainingState = 'IDLE' | 'ANSWERING' | 'REVEALED' | 'DONE';

const BATCH_SIZE = 5;

export function TrainingRoom({ session, weakStats }: TrainingRoomProps) {
  const supabase = createClient();

  const [queue, setQueue]           = useState<UniversalQuestion[]>([]);
  const [queueIdx, setQueueIdx]     = useState(0);
  const [state, setState]           = useState<TrainingState>('IDLE');
  const [answer, setAnswer]         = useState('');
  const [isCorrect, setIsCorrect]   = useState<boolean | null>(null);
  const [score, setScore]           = useState({ correct: 0, total: 0 });
  const [timeLeft, setTimeLeft]     = useState<number | null>(null); // for TIME mode
  const [loading, setLoading]       = useState(false);

  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionIds  = queue.map((q) => q.id);
  const { getElapsed, switchQuestion } = useTimer(questionIds);

  const config = session.config;
  const isTimedMode = config.limit_type === 'TIME';

  // Fetch next batch of questions from weak chapters
  const fetchBatch = useCallback(async () => {
    setLoading(true);
    const chapterIds = weakStats
      .sort((a, b) => a.accuracy_rate - b.accuracy_rate) // weakest first
      .slice(0, 5)
      .map((s) => s.chapter_id);

    if (chapterIds.length === 0) { setLoading(false); return; }

    const { data } = await supabase
      .from('universal_questions')
      .select('*, learning_chapters(*)')
      .in('chapter_id', chapterIds)
      .order('difficulty', { ascending: false }) // hard first
      .limit(BATCH_SIZE);

    if (data) {
      setQueue((prev) => [...prev, ...data]);
    }
    setLoading(false);
  }, [supabase, weakStats]);

  // Initial load + replenish when running low
  useEffect(() => {
    fetchBatch();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (queue.length - queueIdx <= 2) fetchBatch();
  }, [queueIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Start countdown for TIME mode
  useEffect(() => {
    if (!isTimedMode || state !== 'IDLE') return;
    const totalSecs = config.limit_value * 60;
    setTimeLeft(totalSecs);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t === null || t <= 1) {
          clearInterval(timerRef.current!);
          setState('DONE');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    setState('ANSWERING');
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentQ = queue[queueIdx];

  useEffect(() => {
    if (currentQ) switchQuestion(currentQ.id);
  }, [queueIdx, currentQ, switchQuestion]);

  const submitAnswer = useCallback(async () => {
    if (!currentQ || !answer.trim()) return;

    const correct =
      answer.trim().toUpperCase() === currentQ.answer.trim().toUpperCase();
    setIsCorrect(correct);
    setState('REVEALED');
    setScore((prev) => ({
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1,
    }));

    // Persist attempt
    await supabase.from('user_attempts').insert({
      session_id:  session.id,
      question_id: currentQ.id,
      user_answer: answer.trim(),
      is_correct:  correct,
      elapsed_time: getElapsed(currentQ.id),
    });

    // Check COUNT limit
    if (!isTimedMode && score.total + 1 >= config.limit_value) {
      setState('DONE');
    }
  }, [currentQ, answer, supabase, session.id, getElapsed, isTimedMode, config.limit_value, score.total]);

  const nextQuestion = useCallback(() => {
    setAnswer('');
    setIsCorrect(null);
    setQueueIdx((i) => i + 1);
    setState('ANSWERING');
  }, []);

  if (state === 'DONE') {
    const pct = score.total === 0 ? 0 : Math.round((score.correct / score.total) * 100);
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-20">
        <p className="text-4xl font-bold text-brand-600">{pct}%</p>
        <p className="text-gray-600">{score.total}문항 중 {score.correct}문항 정답</p>
        <button
          onClick={() => {
            setScore({ correct: 0, total: 0 });
            setQueueIdx(0);
            setAnswer('');
            setState('ANSWERING');
          }}
          className="px-8 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700"
        >
          다시 도전하기
        </button>
      </div>
    );
  }

  if (loading && !currentQ) {
    return <div className="flex items-center justify-center py-20 text-gray-400">문제 불러오는 중…</div>;
  }

  if (!currentQ) return null;

  const optionKeys = currentQ.options ? Object.keys(currentQ.options) : [];

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            {isTimedMode
              ? `⏱ ${String(Math.floor((timeLeft ?? 0) / 60)).padStart(2, '0')}:${String((timeLeft ?? 0) % 60).padStart(2, '0')}`
              : `${score.total} / ${config.limit_value}`}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${difficultyStyle(currentQ.difficulty).badge}`}>
            {difficultyStyle(currentQ.difficulty).label}
          </span>
        </div>
        <span className="text-sm font-medium text-green-600">
          정답률 {score.total === 0 ? '—' : Math.round((score.correct / score.total) * 100) + '%'}
        </span>
      </div>

      {/* Chapter badge */}
      {currentQ.learning_chapters && (
        <p className="text-xs text-gray-400">
          {currentQ.learning_chapters.level_1} &rsaquo; {currentQ.learning_chapters.level_2}
        </p>
      )}

      {/* Question */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <p className="text-sm text-gray-800 leading-7 whitespace-pre-wrap mb-6">
          {currentQ.question_text}
        </p>

        {/* Options or short answer */}
        {currentQ.question_type !== 'SHORT_ANSWER' && currentQ.options ? (
          <div className="space-y-3">
            {optionKeys.map((key) => {
              const optVal = (currentQ.options as unknown as Record<string, string>)[key];
              const selected = answer === key;
              const revealed = state === 'REVEALED';
              const isRight  = key === currentQ.answer;

              return (
                <button
                  key={key}
                  disabled={revealed}
                  onClick={() => setAnswer(key)}
                  className={`
                    w-full text-left px-4 py-3 rounded-xl border text-sm transition-all
                    ${revealed
                      ? isRight
                        ? 'border-green-500 bg-green-50 text-green-800 font-medium'
                        : selected
                        ? 'border-red-400 bg-red-50 text-red-700'
                        : 'border-gray-200 text-gray-400'
                      : selected
                      ? 'border-brand-500 bg-brand-50 text-brand-800 font-medium'
                      : 'border-gray-200 hover:border-brand-300'}
                  `}
                >
                  <span className="font-bold mr-2">{key}.</span>
                  {optVal}
                </button>
              );
            })}
          </div>
        ) : (
          <input
            type="text"
            placeholder="정답을 입력하세요"
            value={answer}
            disabled={state === 'REVEALED'}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && state === 'ANSWERING' && submitAnswer()}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm
                       focus:outline-none focus:border-brand-400 disabled:bg-gray-50"
          />
        )}

        {/* Revealed result */}
        {state === 'REVEALED' && (
          <div className={`mt-4 p-3 rounded-xl text-sm font-medium
            ${isCorrect ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {isCorrect ? '✓ 정답입니다!' : `✗ 오답 — 정답: ${currentQ.answer}`}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex justify-end">
        {state === 'ANSWERING' ? (
          <button
            onClick={submitAnswer}
            disabled={!answer.trim()}
            className="px-8 py-3 bg-brand-600 text-white rounded-xl text-sm
                       hover:bg-brand-700 disabled:opacity-40"
          >
            제출
          </button>
        ) : state === 'REVEALED' ? (
          <button
            onClick={nextQuestion}
            className="px-8 py-3 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-900"
          >
            다음 문제 →
          </button>
        ) : null}
      </div>
    </div>
  );
}
