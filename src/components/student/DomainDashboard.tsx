import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { buildExams, CURRICULUM_META, type ExamQuestionRow } from '@/lib/exams';
import { DashboardLayout, type DomainNavItem } from '@/components/layout/DashboardLayout';
import {
  ClipboardCheck, Target, ChevronRight, FileText, BookOpen, Award, Zap,
  Lightbulb, Clock, Sparkles, HelpCircle,
} from 'lucide-react';
import type { CategoryType, LearningCategory, WeaknessStat, LanguageExamCard } from '@/types';

/* ── 도메인별 메타 (라벨/색상/가이드 콘텐츠) ───────────────────── */
const DOMAIN_META: Record<CategoryType, {
  label: string;
  badge: string;
  accentFrom: string;
  accentTo: string;
  tips: { icon: 'HelpCircle' | 'Clock' | 'Sparkles'; title: string; body: string }[];
}> = {
  CERT: {
    label: '자격증',
    badge: 'bg-violet-100 text-violet-600',
    accentFrom: 'from-violet-500',
    accentTo: 'to-indigo-500',
    tips: [
      { icon: 'HelpCircle', title: '이 페이지 사용법', body: '실전 모의고사로 출제 범위를 점검하고, 취약 단원 훈련방에서 약점을 집중 보강하세요. 틀린 문제는 오답 보관함에 자동 적립됩니다.' },
      { icon: 'Clock',      title: '망각곡선 복습 주기', body: '자격증 개념은 1일·3일·7일 간격으로 재복습할 때 장기 기억으로 굳어집니다. 오답 보관함을 주기에 맞춰 다시 풀어 보세요.' },
      { icon: 'Sparkles',   title: 'AI 활용 팁', body: 'AI 플래너에 시험일과 가용 시간을 입력하면, 취약 단원 가중치를 반영한 합격 로드맵을 자동 설계합니다.' },
    ],
  },
  LANG: {
    label: '어학',
    badge: 'bg-sky-100 text-sky-600',
    accentFrom: 'from-sky-500',
    accentTo: 'to-cyan-500',
    tips: [
      { icon: 'HelpCircle', title: '이 페이지 사용법', body: '영역(Reading·Listening·Writing)별 모의고사로 실전 감각을 키우고, AI 첨삭이 붙는 에세이 과제로 표현력을 다듬으세요.' },
      { icon: 'Clock',      title: '망각곡선 복습 주기', body: '어휘·표현은 짧고 자주가 핵심입니다. 매일 10분씩 오답 보관함의 표현을 소리 내어 복습하면 인출 강도가 올라갑니다.' },
      { icon: 'Sparkles',   title: 'AI 활용 팁', body: 'Writing 과제는 AI 첨삭 리포트의 문장별 교정 이유까지 읽어야 같은 실수를 반복하지 않습니다.' },
    ],
  },
  SCHOOL: {
    label: '교과',
    badge: 'bg-amber-100 text-amber-600',
    accentFrom: 'from-amber-500',
    accentTo: 'to-orange-500',
    tips: [
      { icon: 'HelpCircle', title: '이 페이지 사용법', body: '커리큘럼 트랙(국내 내신·수능, A-Level 등)별 모의고사를 골라 풀고, 취약 단원 훈련방에서 등급 상승을 노려 보세요.' },
      { icon: 'Clock',      title: '망각곡선 복습 주기', body: '내신·수능 개념은 단원이 끝난 직후, 그리고 시험 2주 전 집중 회독 시 정착률이 가장 높습니다.' },
      { icon: 'Sparkles',   title: 'AI 활용 팁', body: 'AI 플래너가 단원별 약점과 D-Day를 결합해 회독 일정을 배분합니다. 시험 범위가 확정되면 바로 재설정하세요.' },
    ],
  },
};

const GUIDE_ICONS = { HelpCircle, Clock, Sparkles } as const;

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

/* ── 우측 가이드 패널 ─────────────────────────────────────── */
function GuidePanel({ siteType }: { siteType: CategoryType }) {
  const meta = DOMAIN_META[siteType];
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Lightbulb className="text-indigo-500" size={16} />
        <h2 className="text-sm font-bold text-slate-800">{meta.label} 학습 가이드</h2>
      </div>
      {meta.tips.map((tip) => {
        const Icon = GUIDE_ICONS[tip.icon];
        return (
          <div key={tip.title} className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Icon size={13} className="text-indigo-400" />
              {tip.title}
            </p>
            <p className="text-xs text-slate-500 leading-6">{tip.body}</p>
          </div>
        );
      })}
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

  /* 좌측 서브 내비게이션 (도메인 한정) */
  const basePath = `/student/${siteType.toLowerCase()}`;
  const nav: DomainNavItem[] = [
    { href: `${basePath}#exams`,                                  label: '실전 모의고사',    icon: 'FileText',   active: true },
    { href: `/student/training?category=${activeCategoryId}`,     label: '취약 단원 훈련방',  icon: 'Target' },
    { href: '/student/incorrect',                                 label: '오답 보관함',      icon: 'NotebookPen' },
  ];

  /* 카테고리가 없으면 빈 상태만 렌더 (가드 유지) */
  if (!activeCategory) {
    return (
      <DashboardLayout domainLabel={meta.label} domainBadge={meta.badge} nav={nav} guide={<GuidePanel siteType={siteType} />}>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center text-slate-400">
          아직 {meta.label} 학습 카테고리가 없습니다. 곧 콘텐츠가 추가될 예정입니다.
        </div>
      </DashboardLayout>
    );
  }

  /* ── [가드 2] 모든 학습 데이터를 활성 카테고리로 스코프 ── */
  const [{ data: statsRaw }, { data: sessionsRaw }, { data: examRows }] = await Promise.all([
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
  ]);

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
    <DashboardLayout domainLabel={meta.label} domainBadge={meta.badge} nav={nav} guide={<GuidePanel siteType={siteType} />}>
      <div className="space-y-8">
        {/* ── 헤더 ── */}
        <div>
          <p className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full mb-2 ${meta.badge}`}>
            {meta.label}
          </p>
          <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">{activeCategory.title}</h1>
          <p className="text-sm text-slate-400 mt-1">오늘도 한 걸음 더 — 꾸준함이 실력이 됩니다.</p>
        </div>

        {/* ── 카테고리 탭 (동일 도메인 내 전환) ── */}
        {categories.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {categories.map((cat) => {
              const active = cat.id === activeCategoryId;
              return (
                <Link
                  key={cat.id}
                  href={`${basePath}?category=${cat.id}`}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all
                    ${active
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}
                >
                  {cat.title}
                </Link>
              );
            })}
          </div>
        )}

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
    </DashboardLayout>
  );
}
