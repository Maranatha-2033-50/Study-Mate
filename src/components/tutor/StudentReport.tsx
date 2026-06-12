'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { difficultyStyle } from '@/lib/difficulty';
import { RadarChart } from '@/components/ui/RadarChart';
import type {
  Profile, WeaknessStat, StudySession, UserAttempt, UniversalQuestion, SubjectiveFeedback,
} from '@/types';

interface CoachingRow {
  created_at: string;
  feedback:   SubjectiveFeedback;
}

// ── tutor_guide 마크다운 렌더러 ──
function CoachingMD({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h2: ({ children }) => (
          <h2 className="text-base font-bold text-slate-800 mt-4 mb-2 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-bold text-indigo-700 mt-3 mb-1.5">{children}</h3>
        ),
        p: ({ children }) => <p className="text-sm text-slate-600 leading-7 mb-2">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
        ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2 text-sm text-slate-600">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2 text-sm text-slate-600">{children}</ol>,
        li: ({ children }) => <li className="leading-6">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-indigo-300 bg-indigo-50/50 pl-4 py-2 my-2 text-sm text-slate-600 rounded-r">
            {children}
          </blockquote>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

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
  const [coaching, setCoaching] = useState<CoachingRow[]>([]);
  const [coachIdx, setCoachIdx] = useState(0);
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

      // 주관식 AI 코칭 백서 (feedback 컬럼이 채워진 제출본만)
      const { data: subj } = await supabase
        .from('user_attempts')
        .select('created_at, feedback, study_sessions!inner(user_id)')
        .eq('study_sessions.user_id', student.id)
        .not('feedback', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5);

      if (mounted && subj) {
        setCoaching(
          (subj as unknown as { created_at: string; feedback: SubjectiveFeedback }[])
            .filter((r) => r.feedback?.tutor_guide)
            .map((r) => ({ created_at: r.created_at, feedback: r.feedback }))
        );
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
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${difficultyStyle(question?.difficulty).badge}`}>
                        {difficultyStyle(question?.difficulty).label}
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

      {/* ══ [강사 전용] AI 코칭 백서 ══ */}
      {coaching.length > 0 && (() => {
        const active = coaching[coachIdx] ?? coaching[0];
        const fb = active.feedback;
        return (
          <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-white shadow-sm overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center gap-2 px-6 py-4 bg-indigo-600 text-white">
              <Sparkles size={18} />
              <h3 className="font-bold">AI 코칭 백서</h3>
              <span className="flex items-center gap-1 ml-2 text-[11px] font-semibold bg-white/20 px-2 py-0.5 rounded-full">
                <Lock size={11} /> 강사 전용
              </span>
              <span className="ml-auto text-xs text-indigo-200">
                예상 점수 {fb.overall_score}
              </span>
            </div>

            {/* 제출본 선택 탭 (2개 이상일 때) */}
            {coaching.length > 1 && (
              <div className="flex gap-1.5 flex-wrap px-6 pt-4">
                {coaching.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => setCoachIdx(i)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
                      ${i === coachIdx
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    {new Date(c.created_at).toLocaleDateString('ko-KR')}
                  </button>
                ))}
              </div>
            )}

            {/* tutor_guide 마크다운 */}
            <div className="px-6 py-5">
              <CoachingMD>{fb.tutor_guide}</CoachingMD>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
