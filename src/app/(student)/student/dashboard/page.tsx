import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AchievementWidget } from '@/components/student/AchievementWidget';
import { RelativePerformance } from '@/components/student/RelativePerformance';
import {
  ClipboardCheck,
  Target,
  ChevronRight,
  TrendingUp,
  Zap,
  Award,
  BookOpen,
} from 'lucide-react';
import type { WeaknessStat, LearningCategory } from '@/types';

/* ── 통계 미니 카드 ─────────────────────────────────────── */
function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <p className="text-xl font-bold text-slate-800 leading-tight">{value}</p>
      </div>
    </div>
  );
}

/* ── 액션 카드 ──────────────────────────────────────────── */
function ActionCard({
  href,
  icon: Icon,
  iconBg,
  iconColor,
  accentFrom,
  accentTo,
  title,
  description,
  ctaLabel,
  ctaClass,
}: {
  href: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  accentFrom: string;
  accentTo: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaClass: string;
}) {
  return (
    <div className="group relative bg-white rounded-2xl border border-slate-100
                    shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col">
      {/* 상단 그라디언트 액센트 바 */}
      <div className={`h-1 bg-gradient-to-r ${accentFrom} ${accentTo}`} />

      <div className="p-6 flex flex-col flex-1">
        {/* 아이콘 */}
        <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center mb-5
                         group-hover:scale-110 transition-transform duration-300`}>
          <Icon className={iconColor} size={24} />
        </div>

        <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 leading-6 mb-6 flex-1">{description}</p>

        <Link
          href={href}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                      transition-all duration-200 self-start ${ctaClass}`}
        >
          {ctaLabel}
          <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}

/* ── 페이지 ─────────────────────────────────────────────── */
export default async function StudentDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const params = await searchParams;

  const { data: categories } = await supabase
    .from('learning_categories')
    .select('*')
    .order('title');

  const allCategories: LearningCategory[] = categories ?? [];
  const activeCategoryId = params.category ?? allCategories[0]?.id ?? '';
  const activeCategory   = allCategories.find((c) => c.id === activeCategoryId);

  const { data: statsRaw } = await supabase
    .from('weakness_stats')
    .select('*')
    .eq('user_id', user.id)
    .eq('category_id', activeCategoryId);

  const stats: WeaknessStat[] = statsRaw ?? [];

  /* 세션 트렌드 */
  const { data: sessionsRaw } = await supabase
    .from('study_sessions')
    .select('id, created_at')
    .eq('user_id', user.id)
    .eq('category_id', activeCategoryId)
    .eq('status', 'COMPLETED')
    .order('created_at', { ascending: true })
    .limit(8);

  const trend: { date: string; accuracy: number }[] = [];
  for (const sess of sessionsRaw ?? []) {
    const { data: attempts } = await supabase
      .from('user_attempts')
      .select('is_correct')
      .eq('session_id', sess.id);
    if (attempts && attempts.length > 0) {
      const correct = attempts.filter((a) => a.is_correct).length;
      trend.push({
        date:     sess.created_at.slice(0, 10),
        accuracy: Math.round((correct / attempts.length) * 100),
      });
    }
  }

  /* 요약 통계 */
  const totalAttempts = stats.reduce((s, r) => s + r.total_attempts, 0);
  const totalCorrect  = stats.reduce((s, r) => s + r.correct_count, 0);
  const overallAcc    = totalAttempts === 0
    ? '–'
    : `${Math.round((totalCorrect / totalAttempts) * 100)}%`;
  const sessionCount  = sessionsRaw?.length ?? 0;
  const weakCount     = stats.filter((s) => s.accuracy_rate < 60).length;

  return (
    <div className="space-y-8">

      {/* ── 페이지 헤더 ── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-1">
            {activeCategory?.title ?? 'Overview'}
          </p>
          <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">
            학습 대시보드
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            오늘도 한 걸음 더 — 꾸준함이 실력이 됩니다.
          </p>
        </div>
      </div>

      {/* ── 카테고리 탭 ── */}
      {allCategories.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center">
          {allCategories.map((cat) => {
            const active = cat.id === activeCategoryId;
            const typeBadge: Record<string, string> = {
              CERT:   'bg-violet-100 text-violet-600',
              LANG:   'bg-sky-100    text-sky-600',
              SCHOOL: 'bg-amber-100  text-amber-600',
            };
            const typeLabel: Record<string, string> = {
              CERT:   '자격',
              LANG:   '어학',
              SCHOOL: '교과',
            };
            return (
              <Link
                key={cat.id}
                href={`/student/dashboard?category=${cat.id}`}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium
                            border transition-all duration-200
                  ${active
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}
              >
                {/* 유형 뱃지 */}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded
                  ${active ? 'bg-white/20 text-white' : typeBadge[cat.type]}`}>
                  {typeLabel[cat.type] ?? cat.type}
                </span>
                {cat.title}
              </Link>
            );
          })}
        </div>
      )}

      {/* ── 요약 통계 3열 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={BookOpen}
          label="완료 세션"
          value={`${sessionCount}회`}
          color="bg-indigo-50 text-indigo-600"
        />
        <StatCard
          icon={Award}
          label="전체 정답률"
          value={overallAcc}
          color="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          icon={Zap}
          label="취약 단원"
          value={`${weakCount}개`}
          color="bg-rose-50 text-rose-500"
        />
      </div>

      {/* ── 핵심 액션 카드 2열 그리드 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ActionCard
          href={`/student/diagnostic?category=${activeCategoryId}`}
          icon={ClipboardCheck}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
          accentFrom="from-indigo-500"
          accentTo="to-violet-500"
          title="진단 및 평가"
          description="현재 실력을 정밀하게 측정하고 영역별 취약점을 분석합니다. 진단 결과를 바탕으로 AI가 맞춤형 학습 계획을 자동 수립합니다."
          ctaLabel="지금 시작하기"
          ctaClass="bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow-indigo-200 hover:shadow-md"
        />
        <ActionCard
          href={`/student/training?category=${activeCategoryId}`}
          icon={Target}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          accentFrom="from-emerald-400"
          accentTo="to-teal-500"
          title="취약 단원 무한 훈련방"
          description="AI가 오답 기록을 분석하여 취약 단원 문제를 실시간으로 생성합니다. COUNT 또는 TIME 챌린지로 집중 훈련을 시작하세요."
          ctaLabel="훈련방 입장"
          ctaClass="border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50 hover:shadow-emerald-100 hover:shadow-md"
        />
      </div>

      {/* ── 성취 현황 ── */}
      <div>
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp className="text-indigo-500" size={18} />
          <h2 className="text-lg font-bold text-slate-900">성취 현황</h2>
          {stats.length > 0 && (
            <span className="ml-auto text-xs text-slate-400">
              {stats.length}개 단원 · {totalAttempts}문항 풀이
            </span>
          )}
        </div>
        <AchievementWidget stats={stats} trend={trend} />
      </div>

      {/* ── 상대 위치 지표 ── */}
      {stats.length > 0 && <RelativePerformance stats={stats} />}
    </div>
  );
}
