import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { buildExams, CURRICULUM_META, type ExamQuestionRow } from '@/lib/exams';
import { StudentShell } from '@/components/layout/StudentChrome';
import { PacemakerBanner } from '@/components/student/PacemakerBanner';
import { computeStudyBudget } from '@/lib/planner-budget';
import { DOMAIN_META } from '@/lib/domain';
import {
  ClipboardCheck, Target, ChevronRight, FileText, BookOpen, Award, Zap,
} from 'lucide-react';
import type {
  CategoryType, LearningCategory, WeaknessStat, LanguageExamCard,
  AIStudyPlanRow, InteractivePlan,
} from '@/types';

/* ── 미니 통계 카드 ───────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string | number; color: string;
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

/* ── 핵심 액션 카드 ───────────────────────────────────────── */
function ActionCard({ href, icon: Icon, iconBg, iconColor, accent, title, description, ctaLabel, ctaClass }: {
  href: string; icon: React.ElementType; iconBg: string; iconColor: string; accent: string;
  title: string; description: string; ctaLabel: string; ctaClass: string;
}) {
  return (
    <div className="group relative bg-white rounded-2xl border border-slate-100 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col">
      <div className={`h-1 bg-gradient-to-r ${accent}`} />
      <div className="p-6 flex flex-col flex-1">
        <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
          <Icon className={iconColor} size={24} />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 leading-6 mb-6 flex-1">{description}</p>
        <Link href={href} className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 self-start ${ctaClass}`}>
          {ctaLabel}
          <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}

/* ── 모의고사 카드 ────────────────────────────────────────── */
function ExamCard({ exam }: { exam: LanguageExamCard }) {
  const isEssay = exam.kind === 'ESSAY';
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600">{exam.skill}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg
          ${isEssay ? 'text-amber-600 bg-amber-50 border border-amber-200' : 'text-emerald-600 bg-emerald-50 border border-emerald-200'}`}>
          {isEssay ? 'AI 첨삭' : '객관식'}
        </span>
      </div>
      <p className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors leading-snug flex-1">{exam.title}</p>
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span>{isEssay ? '✍️ 에세이 1문항' : `📋 ${exam.questionCount}문항`}</span>
      </div>
      <Link href={exam.href} className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-indigo-600 transition-colors duration-200">
        {isEssay ? '시험 시작 (AI 첨삭) →' : '시험 시작 →'}
      </Link>
    </div>
  );
}

/* ── 도메인 대시보드 (자격/어학/교과 공용) ─────────────────────
   site_type 가드: learning_categories.type === siteType 으로 카테고리를 한정하고,
   모든 학습 이력/오답/통계 쿼리를 그 카테고리(category_id)에만 스코프하여
   도메인 간 데이터 간섭을 차단한다. */
export async function DomainDashboard({
  siteType,
  categoryParam,
}: {
  siteType: CategoryType;
  categoryParam?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const meta = DOMAIN_META[siteType];

  /* ── [가드 1] 카테고리를 현재 도메인 타입으로 강제 한정 ── */
  const { data: categoriesRaw } = await supabase
    .from('learning_categories')
    .select('*')
    .eq('type', siteType)
    .order('title');

  const categories: LearningCategory[] = categoriesRaw ?? [];
  const activeCategoryId = categoryParam ?? categories[0]?.id ?? '';
  const activeCategory   = categories.find((c) => c.id === activeCategoryId);

  /* 카테고리가 없으면 빈 상태만 렌더 (가드 유지) */
  if (!activeCategory) {
    return (
      <StudentShell>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center text-slate-400">
          아직 {meta.label} 학습 카테고리가 없습니다. 곧 콘텐츠가 추가될 예정입니다.
        </div>
      </StudentShell>
    );
  }

  /* ── [가드 2] 모든 학습 데이터를 활성 카테고리로 스코프 ──
     AI 페이스메이커 배너의 학습 플랜도 활성 카테고리에 한정해 도메인 격리를 유지한다. */
  const [
    { data: statsRaw }, { data: sessionsRaw }, { data: examRows },
    { data: profile }, { data: latestPlanRaw },
  ] = await Promise.all([
    supabase
      .from('weakness_stats')
      .select('*')
      .eq('user_id', user.id)
      .eq('category_id', activeCategoryId),
    supabase
      .from('study_sessions')
      .select('id')
      .eq('user_id', user.id)
      .eq('category_id', activeCategoryId)
      .eq('status', 'COMPLETED'),
    supabase
      .from('universal_questions')
      .select('id, question_type, chapter_id, learning_chapters!inner(category_id, level_1, level_2, curriculum_code)')
      .eq('learning_chapters.category_id', activeCategoryId),
    supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('ai_study_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('category_id', activeCategoryId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  /* AI 페이스메이커 진행도 (활성 카테고리 최신 플랜) */
  const latestPlan = latestPlanRaw as AIStudyPlanRow | null;
  let pacemaker = { hasPlan: false, dDay: 0, pct: 0, done: 0, total: 0 };
  if (latestPlan?.plan_content && latestPlan.exam_date) {
    try {
      const parsed     = JSON.parse(latestPlan.plan_content) as InteractivePlan;
      const milestones = parsed.milestones ?? [];
      const completed  = latestPlan.completed_items ?? {};
      const total = milestones.length;
      const done  = milestones.filter((m) => completed[m.id]).length;
      if (total > 0) {
        const { dDay } = computeStudyBudget(latestPlan.exam_date, latestPlan.availability_matrix ?? {});
        pacemaker = { hasPlan: true, dDay, pct: Math.round((done / total) * 100), done, total };
      }
    } catch { /* plan_content 파싱 실패 → 가드 표시 */ }
  }

  const stats: WeaknessStat[] = statsRaw ?? [];
  const exams = buildExams((examRows ?? []) as unknown as ExamQuestionRow[], activeCategoryId);

  /* 커리큘럼 트랙(KR/UK/CA 등)별 그룹핑 — 코드가 하나도 없으면 단일 평면 그룹 */
  const CURRICULUM_ORDER = ['KR_HIGH_MATH', 'UK_ALEVEL_MATH', 'CA_ON_MATH'];
  const examGroups: [string, LanguageExamCard[]][] = exams.some((e) => e.curriculumCode)
    ? Object.entries(
        exams.reduce<Record<string, LanguageExamCard[]>>((acc, e) => {
          const k = e.curriculumCode ?? 'OTHER';
          (acc[k] ??= []).push(e);
          return acc;
        }, {}),
      ).sort(([a], [b]) => {
        const ia = CURRICULUM_ORDER.indexOf(a), ib = CURRICULUM_ORDER.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      })
    : [['', exams]];

  /* 요약 통계 */
  const totalAttempts = stats.reduce((s, r) => s + r.total_attempts, 0);
  const totalCorrect  = stats.reduce((s, r) => s + r.correct_count, 0);
  const overallAcc    = totalAttempts === 0 ? '–' : `${Math.round((totalCorrect / totalAttempts) * 100)}%`;
  const sessionCount  = sessionsRaw?.length ?? 0;
  const weakCount     = stats.filter((s) => s.accuracy_rate < 60).length;

  return (
    <StudentShell>
      <div className="space-y-8">
        {/* ── AI 페이스메이커 진행도 배너 (활성 카테고리 기준) ── */}
        <PacemakerBanner name={profile?.name ?? ''} {...pacemaker} />

        {/* ── 헤더 ── */}
        <div>
          <p className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full mb-2 ${meta.badge}`}>
            {meta.label}
          </p>
          <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">{activeCategory.title}</h1>
          <p className="text-sm text-slate-400 mt-1">오늘도 한 걸음 더 — 꾸준함이 실력이 됩니다.</p>
        </div>

        {/* ── 요약 통계 ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={BookOpen} label="완료 세션"   value={`${sessionCount}회`} color="bg-indigo-50 text-indigo-600" />
          <StatCard icon={Award}    label="전체 정답률" value={overallAcc}          color="bg-emerald-50 text-emerald-600" />
          <StatCard icon={Zap}      label="취약 단원"   value={`${weakCount}개`}    color="bg-rose-50 text-rose-500" />
        </div>

        {/* ── 핵심 액션 카드 ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ActionCard
            href={`/student/diagnostic?category=${activeCategoryId}`}
            icon={ClipboardCheck} iconBg="bg-indigo-50" iconColor="text-indigo-600"
            accent={`${meta.accentFrom} ${meta.accentTo}`}
            title="진단 및 평가"
            description="현재 실력을 정밀하게 측정하고 영역별 취약점을 분석합니다. 결과를 바탕으로 AI가 맞춤형 학습 계획을 설계합니다."
            ctaLabel="지금 시작하기"
            ctaClass="bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow-indigo-200 hover:shadow-md"
          />
          <ActionCard
            href={`/student/training?category=${activeCategoryId}`}
            icon={Target} iconBg="bg-emerald-50" iconColor="text-emerald-600"
            accent="from-emerald-400 to-teal-500"
            title="취약 단원 무한 훈련방"
            description="AI가 오답 기록을 분석해 취약 단원 문제를 실시간으로 생성합니다. COUNT 또는 TIME 챌린지로 집중 훈련하세요."
            ctaLabel="훈련방 입장"
            ctaClass="border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50 hover:shadow-emerald-100 hover:shadow-md"
          />
        </div>

        {/* ── 실전 모의고사 카탈로그 ── */}
        {exams.length > 0 && (
          <div id="exams" className="space-y-6 scroll-mt-24">
            <div className="flex items-center gap-2">
              <FileText className="text-indigo-500" size={18} />
              <h2 className="text-lg font-bold text-slate-900">실전 모의고사</h2>
              <span className="ml-auto text-xs text-slate-400">{exams.length}개 세트</span>
            </div>
            {examGroups.map(([code, cards]) => (
              <div key={code || 'flat'}>
                {code && CURRICULUM_META[code] && (
                  <div className={`inline-flex items-center gap-1.5 mb-3 px-3 py-1 rounded-full text-xs font-bold border ${CURRICULUM_META[code].badge}`}>
                    {CURRICULUM_META[code].label}
                    <span className="opacity-70">· {cards.length}세트</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {cards.map((exam) => <ExamCard key={exam.id} exam={exam} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </StudentShell>
  );
}
