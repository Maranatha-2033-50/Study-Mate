'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DiagnosticTestRoom } from '@/components/student/DiagnosticTestRoom';
import { StudentShell } from '@/components/layout/StudentChrome';
import { PaywallModal } from '@/components/student/PaywallModal';
import { DOMAIN_HOME, readDomainCookieClient } from '@/lib/domain';
import { normalizeTier, canStartDiagnostic } from '@/lib/subscription';
import type { StudySession, ClientQuestion } from '@/types';

type Phase = 'CONFIG' | 'TESTING' | 'DONE' | 'PREVIEW';

// 응시용 안전 컬럼 — answer/explanation 은 절대 클라이언트로 내려보내지 않는다(블라인드 채점).
const SAFE_QUESTION_COLS =
  'id, chapter_id, question_type, question_text, options, difficulty, passage, created_at, learning_chapters!inner(category_id, level_1, level_2)';

// AI 일시 실패 시 메모리상 일회성 미리보기(채점 불가) 문항
interface PreviewQuestion {
  question_text: string;
  options:       Record<string, string> | null;
  difficulty?:   string;
}

export default function DiagnosticPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const categoryId   = searchParams.get('category') ?? '';
  const chapterId    = searchParams.get('chapter') ?? '';   // 모의고사: 특정 단원만 출제
  const previewFlag  = searchParams.get('preview');         // AI 일시 실패 미리보기 진입
  const supabase     = createClient();

  const [phase,     setPhase]     = useState<Phase>('CONFIG');
  const [count,     setCount]     = useState(20);
  const [session,   setSession]   = useState<StudySession | null>(null);
  const [questions, setQuestions] = useState<ClientQuestion[]>([]);
  const [preview,   setPreview]   = useState<PreviewQuestion[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [paywall,   setPaywall]   = useState(false);

  // 미리보기 진입: sessionStorage 에 적재된 Mock 문항을 1회 읽고 즉시 폐기(일회성).
  useEffect(() => {
    if (previewFlag !== '1') return;
    try {
      const raw = sessionStorage.getItem('diag_preview');
      if (raw) {
        setPreview(JSON.parse(raw) as PreviewQuestion[]);
        setPhase('PREVIEW');
      }
      sessionStorage.removeItem('diag_preview');
    } catch { /* 손상된 페이로드는 무시하고 CONFIG 로 폴백 */ }
  }, [previewFlag]);

  const startSession = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    // [등급 페이월 가드] Basic 은 최초 진단 모의고사 1회까지만 — 초과 시 업그레이드 유도
    const { data: profile } = await supabase
      .from('profiles').select('subscription_status').eq('id', user.id).single();
    const tier = normalizeTier(profile?.subscription_status ?? null);
    const { count: diagUsed } = await supabase
      .from('study_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('session_type', 'DIAGNOSTIC');
    if (!canStartDiagnostic(tier, diagUsed ?? 0)) {
      setPaywall(true);
      setLoading(false);
      return;
    }

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
      .select(SAFE_QUESTION_COLS);
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
    setQuestions(qs as unknown as ClientQuestion[]);
    setPhase('TESTING');
    setLoading(false);
  };

  if (phase === 'PREVIEW') {
    return (
      <StudentShell>
        <div className="max-w-2xl mx-auto px-6 py-12 space-y-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-sm font-bold text-amber-800">AI 일시 실패 · 미리보기 (채점 불가)</p>
            <p className="mt-1 text-xs text-amber-700">
              실시간 출제 엔진이 응답하지 않아 표본 문항을 임시로 보여드립니다. 이 문항은 저장되지 않으며 채점되지 않습니다.
              잠시 후 다시 시도하면 정식 문제로 출제됩니다.
            </p>
          </div>

          {preview.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">표시할 미리보기 문항이 없습니다.</p>
          ) : (
            <ol className="space-y-4">
              {preview.map((q, i) => (
                <li key={i} className="rounded-xl border border-gray-200 bg-white p-5">
                  <p className="text-sm font-semibold text-gray-800 mb-3">
                    <span className="text-gray-400 mr-1">Q{i + 1}.</span>{q.question_text}
                  </p>
                  {q.options && (
                    <ul className="space-y-1.5">
                      {Object.entries(q.options).map(([key, val]) => (
                        <li key={key} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className="w-5 h-5 flex-none rounded bg-gray-100 text-xs font-bold flex items-center justify-center mt-0.5">{key}</span>
                          <span>{val}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}

          <button
            onClick={() => {
              const domain = readDomainCookieClient();
              const home = domain ? DOMAIN_HOME[domain] : '/';
              router.push(home);
            }}
            className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800"
          >
            돌아가기
          </button>
        </div>
      </StudentShell>
    );
  }

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
      <PaywallModal
        open={paywall}
        onClose={() => setPaywall(false)}
        feature={chapterId ? '실전 모의고사 무제한 응시' : '추가 진단 모의고사'}
      />
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
