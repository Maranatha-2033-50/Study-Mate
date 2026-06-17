'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DiagnosticTestRoom } from '@/components/student/DiagnosticTestRoom';
import { StudentShell } from '@/components/layout/StudentChrome';
import { DOMAIN_HOME, readDomainCookieClient } from '@/lib/domain';
import type { StudySession, UniversalQuestion } from '@/types';

type Phase = 'CONFIG' | 'TESTING' | 'DONE';

export default function DiagnosticPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const categoryId   = searchParams.get('category') ?? '';
  const chapterId    = searchParams.get('chapter') ?? '';   // 모의고사: 특정 단원만 출제
  const supabase     = createClient();

  const [phase,     setPhase]     = useState<Phase>('CONFIG');
  const [count,     setCount]     = useState(20);
  const [session,   setSession]   = useState<StudySession | null>(null);
  const [questions, setQuestions] = useState<UniversalQuestion[]>([]);
  const [loading,   setLoading]   = useState(false);

  const startSession = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    const { data: sess, error: sessErr } = await supabase
      .from('study_sessions')
      .insert({
        user_id:      user.id,
        category_id:  categoryId,
        session_type: 'DIAGNOSTIC',
        config:       { limit_type: 'COUNT', limit_value: count },
        status:       'IN_PROGRESS',
      })
      .select()
      .single();

    if (sessErr || !sess) { alert('세션 생성 실패'); setLoading(false); return; }

    // 모의고사(chapter 지정): 해당 단원 문항 전체 / 일반 진단: 카테고리 객관식 문항 표본
    const base = supabase
      .from('universal_questions')
      .select('*, learning_chapters!inner(category_id, level_1, level_2)');
    const query = chapterId
      ? base.eq('chapter_id', chapterId)
      : base.eq('learning_chapters.category_id', categoryId).neq('question_type', 'ESSAY').limit(count);
    const { data: qs } = await query;

    if (!qs || qs.length === 0) {
      alert('해당 카테고리에 문제가 없습니다.');
      setLoading(false);
      return;
    }

    setSession(sess);
    setQuestions(qs);
    setPhase('TESTING');
    setLoading(false);
  };

  if (phase === 'CONFIG') {
    return (
      <StudentShell>
      <div className="max-w-md mx-auto px-6 py-16 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {chapterId ? '실전 모의고사' : '진단 평가 설정'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {chapterId
              ? '지문과 타이머가 작동하는 실전 시험방으로 입장합니다. 준비되면 시작하세요.'
              : '실력 진단에 사용할 문항 수를 선택하세요.'}
          </p>
        </div>
        {!chapterId && (
          <div className="space-y-3">
            {[10, 20, 30, 50].map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={`w-full py-3 rounded-xl border text-sm font-medium transition-colors
                  ${count === n
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-200 text-gray-700 hover:border-blue-300'}`}
              >
                {n}문항
              </button>
            ))}
          </div>
        )}
        <button
          onClick={startSession}
          disabled={loading || !categoryId}
          className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold
                     hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {loading ? '준비 중…' : chapterId ? '시험 시작' : '진단 시작'}
        </button>
      </div>
      </StudentShell>
    );
  }

  if (phase === 'TESTING' && session && questions.length > 0) {
    return (
      <DiagnosticTestRoom
        session={session}
        questions={questions}
        onComplete={() => setPhase('DONE')}
      />
    );
  }

  if (phase === 'DONE') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <h2 className="text-2xl font-bold text-gray-900">진단 완료!</h2>
        <p className="text-gray-500">취약 단원 분석이 대시보드에 반영되었습니다.</p>
        <div className="flex gap-4">
          <button
            onClick={() => {
              const domain = readDomainCookieClient();
              const home = domain ? DOMAIN_HOME[domain] : '/';
              router.push(categoryId ? `${home}?category=${categoryId}` : home);
            }}
            className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
          >
            결과 보기
          </button>
          <button
            onClick={() => router.push(`/student/planner?category=${categoryId}`)}
            className="px-8 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700"
          >
            AI 플래너 생성
          </button>
        </div>
      </div>
    );
  }

  return null;
}
