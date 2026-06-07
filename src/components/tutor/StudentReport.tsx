'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { RadarChart } from '@/components/ui/RadarChart';
import type { Profile, WeaknessStat, StudySession, UserAttempt, UniversalQuestion } from '@/types';

interface RecentAttemptRow {
  attempt: UserAttempt;
  question: UniversalQuestion;
}

interface StudentReportProps {
  student: Profile;
}

export function StudentReport({ student }: StudentReportProps) {
  const supabase = createClient();

  const [stats,    setStats]    = useState<WeaknessStat[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [recent,   setRecent]   = useState<RecentAttemptRow[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      const [statsRes, sessionsRes] = await Promise.all([
        supabase
          .from('weakness_stats')
          .select('*')
          .eq('user_id', student.id)
          .order('accuracy_rate', { ascending: true }),
        supabase
          .from('study_sessions')
          .select('*')
          .eq('user_id', student.id)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      if (!mounted) return;
      setStats(statsRes.data ?? []);
      setSessions(sessionsRes.data ?? []);

      // Recent incorrect attempts with question detail
      const latestSession = sessionsRes.data?.[0];
      if (latestSession) {
        const { data: attempts } = await supabase
          .from('user_attempts')
          .select('*, universal_questions(*)')
          .eq('session_id', latestSession.id)
          .eq('is_correct', false)
          .order('elapsed_time', { ascending: false })
          .limit(10);

        if (mounted && attempts) {
          setRecent(
            attempts.map((a) => ({
              attempt:  a,
              question: a.universal_questions as unknown as UniversalQuestion,
            }))
          );
        }
      }

      setLoading(false);
    }

    load();
    return () => { mounted = false; };
  }, [student.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Aggregate by level_1 for radar
  const byLevel1 = stats.reduce<Record<string, { total: number; correct: number }>>(
    (acc, s) => {
      if (!acc[s.level_1]) acc[s.level_1] = { total: 0, correct: 0 };
      acc[s.level_1].total   += s.total_attempts;
      acc[s.level_1].correct += s.correct_count;
      return acc;
    },
    {}
  );

  const radarLabels = Object.keys(byLevel1);
  const radarData   = radarLabels.map(
    (l) => Math.round((byLevel1[l].correct / byLevel1[l].total) * 100)
  );

  // Top 3 weak chapters
  const top3Weak = stats.slice(0, 3);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">불러오는 중…</div>;
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">{student.name}</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          총 {sessions.length}회 세션 · 최근 세션:{' '}
          {sessions[0] ? new Date(sessions[0].created_at).toLocaleDateString('ko-KR') : '없음'}
        </p>
      </div>

      {/* Radar + Weak list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-500 mb-4">영역별 정답률</h3>
          {radarLabels.length > 0 ? (
            <RadarChart
              labels={radarLabels}
              datasets={[{ label: '정답률 (%)', data: radarData, color: '#3b82f6' }]}
            />
          ) : (
            <p className="text-gray-400 text-sm text-center py-8">데이터 없음</p>
          )}
        </div>

        {/* Weakness list */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-500 mb-4">취약 단원 Top-3</h3>
          {top3Weak.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">데이터 없음</p>
          ) : (
            <div className="space-y-4">
              {top3Weak.map((s, i) => (
                <div key={s.chapter_id}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-700">
                      <span className="font-semibold text-red-500 mr-1">#{i + 1}</span>
                      {s.level_1} &rsaquo; {s.level_2}
                    </span>
                    <span className="text-xs font-semibold text-red-500">
                      {s.accuracy_rate}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-400 rounded-full"
                      style={{ width: `${s.accuracy_rate}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {s.total_attempts}문항 시도 · 평균 소요 {s.avg_elapsed_seconds}초
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent wrong answers */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-500 mb-4">
          최근 오답 목록 (최신 세션 기준)
        </h3>
        {recent.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">최근 오답 없음</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">문제</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">난이도</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">학생 답</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">정답</th>
                  <th className="px-3 py-2 text-right text-gray-500 font-medium">소요시간</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(({ attempt, question }) => (
                  <tr key={attempt.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-700 max-w-xs truncate">
                      {question?.question_text?.slice(0, 50)}…
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium
                        ${question?.difficulty === '상' ? 'bg-red-100 text-red-700'
                          : question?.difficulty === '중' ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'}`}>
                        {question?.difficulty}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-red-500 font-medium">{attempt.user_answer}</td>
                    <td className="px-3 py-2 text-green-600 font-medium">{question?.answer}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{attempt.elapsed_time}초</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
