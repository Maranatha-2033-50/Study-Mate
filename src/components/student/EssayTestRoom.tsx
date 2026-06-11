'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Clock, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { SubjectiveFeedback } from '@/components/SubjectiveFeedback';
import type {
  UniversalQuestion, SubjectiveExamType, SubjectiveFeedback as Feedback,
} from '@/types';

interface Props {
  question:   UniversalQuestion;
  categoryId: string;
  examType:   SubjectiveExamType;
}

type Phase = 'WRITING' | 'GRADING' | 'DONE';

export function EssayTestRoom({ question, categoryId, examType }: Props) {
  const router   = useRouter();
  const supabase = createClient();

  const prompt = question.question_text.replace(/\\n/g, '\n');

  const [phase,    setPhase]    = useState<Phase>('WRITING');
  const [essay,    setEssay]    = useState('');
  const [secs,     setSecs]     = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [error,    setError]    = useState('');

  // 경과 시간 카운트업 (작성 단계에서만)
  useEffect(() => {
    if (phase !== 'WRITING') return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const wordCount = essay.trim() ? essay.trim().split(/\s+/).length : 0;
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');

  const submit = async () => {
    if (wordCount < 50) {
      if (!confirm(`아직 ${wordCount} 단어입니다. IELTS Task 2는 최소 250 단어를 권장합니다. 그래도 제출할까요?`)) return;
    }
    setError('');
    setPhase('GRADING');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    // 채점 결과 저장용 SUBJECTIVE 세션 생성 (마이그레이션 003 적용 후 user_attempts 저장)
    const { data: sess } = await supabase
      .from('study_sessions')
      .insert({
        user_id:      user.id,
        category_id:  categoryId,
        session_type: 'SUBJECTIVE',
        config:       { limit_type: 'COUNT', limit_value: 1 },
        status:       'COMPLETED',
      })
      .select()
      .single();

    try {
      const res = await fetch('/api/grade-subjective', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exam_type:     examType,
          question_text: prompt,
          answer:        essay,
          session_id:    sess?.id,
          question_id:   question.id,
        }),
      });
      if (!res.ok) throw new Error('채점 실패');
      const data = await res.json();
      setFeedback(data.feedback as Feedback);
      setPhase('DONE');
    } catch {
      setError('AI 채점 중 오류가 발생했습니다. 다시 시도해 주세요.');
      setPhase('WRITING');
    }
  };

  // ── 결과 화면 ──
  if (phase === 'DONE' && feedback) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <SubjectiveFeedback feedback={feedback} examType={examType} />

        {/* 내가 제출한 답안 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-3">내가 제출한 답안</h3>
          <p className="text-sm text-slate-600 leading-7 whitespace-pre-wrap">{essay}</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => router.push(`/student/language?category=${categoryId}`)}
            className="px-6 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
          >
            대시보드로 돌아가기
          </button>
          <button
            onClick={() => { setEssay(''); setSecs(0); setFeedback(null); setPhase('WRITING'); }}
            className="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"
          >
            다시 작성하기
          </button>
        </div>
      </div>
    );
  }

  // ── 작성 / 채점 중 화면 ──
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-slate-50">
      {/* 상단 툴바 */}
      <div className="flex-none flex items-center justify-between bg-slate-900 px-5 py-3.5">
        <span className="text-white font-semibold text-sm">
          {examType} Writing — Task 2
        </span>
        <div className="flex items-center gap-4 text-slate-300 text-sm">
          <span className="flex items-center gap-1.5 font-mono">
            <Clock size={14} /> {mm}:{ss}
          </span>
          <span className="text-xs">{wordCount} words</span>
        </div>
      </div>

      {/* 2열: 좌 프롬프트 / 우 작성 */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
        {/* 좌: 문항 */}
        <div className="border-r border-slate-200 bg-white p-7 overflow-y-auto">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Task</span>
          <div className="mt-4 space-y-3 text-sm text-slate-700 leading-7
                          [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-slate-800 [&_h2]:mb-2
                          [&_strong]:font-semibold [&_strong]:text-slate-900 [&_p]:mb-3">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{prompt}</ReactMarkdown>
          </div>
        </div>

        {/* 우: 에세이 작성 */}
        <div className="flex flex-col bg-slate-50 p-7 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Your Response</span>
            <span className={`text-xs font-medium ${wordCount >= 250 ? 'text-emerald-600' : 'text-slate-400'}`}>
              {wordCount} / 250 words
            </span>
          </div>

          <textarea
            value={essay}
            onChange={(e) => setEssay(e.target.value)}
            disabled={phase === 'GRADING'}
            placeholder="Write your essay here…"
            className="flex-1 w-full resize-none rounded-xl border border-slate-200 bg-white
                       px-4 py-3 text-sm text-slate-800 leading-7
                       focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100
                       disabled:bg-slate-100"
          />

          {error && <p className="mt-3 text-xs text-rose-500">{error}</p>}

          <button
            onClick={submit}
            disabled={phase === 'GRADING' || essay.trim().length === 0}
            className="mt-4 inline-flex items-center justify-center gap-2 py-3.5 rounded-xl
                       bg-indigo-600 text-white text-sm font-semibold
                       hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {phase === 'GRADING'
              ? 'AI 채점 중…'
              : <><Send size={15} /> 제출하고 AI 첨삭 받기</>}
          </button>
        </div>
      </div>
    </div>
  );
}
