'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TrainingRoom } from '@/components/student/TrainingRoom';
import { StudentShell } from '@/components/layout/StudentChrome';
import { PaywallModal } from '@/components/student/PaywallModal';
import { normalizeTier, canStartTraining } from '@/lib/subscription';
import type { StudySession, WeaknessStat } from '@/types';

type LimitType = 'COUNT' | 'TIME';

export default function TrainingPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const categoryId   = searchParams.get('category') ?? '';
  const supabase     = createClient();

  const [limitType,  setLimitType]  = useState<LimitType>('COUNT');
  const [limitValue, setLimitValue] = useState(10);
  const [session,    setSession]    = useState<StudySession | null>(null);
  const [weakStats,  setWeakStats]  = useState<WeaknessStat[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [started,    setStarted]    = useState(false);
  const [paywall,    setPaywall]    = useState(false);

  const startTraining = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    // [등급 페이월 가드] Basic 은 취약 훈련방 1회권까지만 — 초과 시 업그레이드 유도.
    //  오답노트의 '다시 풀기'(limit_value=1 재도전 세션)는 전용 훈련 카운트에서 제외한다.
    const { data: profile } = await supabase
      .from('profiles').select('subscription_status').eq('id', user.id).single();
    const tier = normalizeTier(profile?.subscription_status ?? null);
    const { count: trainUsed } = await supabase
      .from('study_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('session_type', 'INFINITE_TRAINING')
      .neq('config->>limit_value', '1');
    if (!canStartTraining(tier, trainUsed ?? 0)) {
      setPaywall(true);
      setLoading(false);
      return;
    }

    const { data: stats } = await supabase
      .from('weakness_stats')
      .select('*')
      .eq('user_id', user.id)
      .eq('category_id', categoryId)
      .order('accuracy_rate', { ascending: true });

    const chapterIds = (stats ?? []).slice(0, 5).map((s: WeaknessStat) => s.chapter_id);

    const { data: sess } = await supabase
      .from('study_sessions')
      .insert({
        user_id:      user.id,
        category_id:  categoryId,
        session_type: 'INFINITE_TRAINING',
        config: { limit_type: limitType, limit_value: limitValue, chapter_ids: chapterIds },
        status: 'IN_PROGRESS',
      })
      .select()
      .single();

    if (sess) {
      setSession(sess);
      setWeakStats(stats ?? []);
      setStarted(true);
    }
    setLoading(false);
  };

  if (!started) {
    const presets: { label: string; type: LimitType; value: number }[] = [
      { label: '10문항 챌린지', type: 'COUNT', value: 10 },
      { label: '20문항 마라톤', type: 'COUNT', value: 20 },
      { label: '15분 타임어택', type: 'TIME',  value: 15 },
      { label: '30분 집중훈련', type: 'TIME',  value: 30 },
    ];

    return (
      <StudentShell>
      <div className="max-w-md mx-auto px-6 py-16 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">취약 단원 무한 훈련방</h1>
          <p className="text-sm text-gray-500 mt-1">
            AI가 오답 기록을 분석하여 맞춤 문제를 실시간으로 생성합니다.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {presets.map((p) => {
            const active = limitType === p.type && limitValue === p.value;
            return (
              <button
                key={p.label}
                onClick={() => { setLimitType(p.type); setLimitValue(p.value); }}
                className={`py-4 rounded-xl border text-sm font-medium transition-colors
                  ${active
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'border-gray-200 text-gray-700 hover:border-purple-300'}`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={startTraining}
          disabled={loading || !categoryId}
          className="w-full py-4 bg-purple-600 text-white rounded-xl font-semibold
                     hover:bg-purple-700 disabled:opacity-60 transition-colors"
        >
          {loading ? '준비 중…' : '훈련 시작'}
        </button>
      </div>
      <PaywallModal
        open={paywall}
        onClose={() => setPaywall(false)}
        feature="취약 단원 무한 훈련방"
      />
      </StudentShell>
    );
  }

  if (session) return <TrainingRoom session={session} weakStats={weakStats} />;
  return null;
}
