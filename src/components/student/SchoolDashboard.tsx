'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ClipboardCheck, Target, ChevronRight, FileText, BookOpen, Award, Zap, Globe2 } from 'lucide-react';
import { useCurriculumStore } from '@/stores/curriculumStore';
import { PacemakerBanner } from '@/components/student/PacemakerBanner';
import { computeStudyBudget } from '@/lib/planner-budget';
import type { LanguageExamCard, AvailabilityMatrix, InteractivePlan } from '@/types';

export interface SchoolStat {
  chapter_id: string; category_id: string; level_1: string; level_2: string;
  total_attempts: number; correct_count: number; accuracy_rate: number;
}
export interface SchoolPlan {
  category_id: string; plan_content: string | null; exam_date: string | null;
  completed_items: Record<string, boolean>; availability_matrix: AvailabilityMatrix; updated_at: string;
}
export interface ChapterMeta {
  country: string | null; grade: string | null; stream: string | null; category_id: string;
}

interface Props {
  exams:             LanguageExamCard[];
  stats:             SchoolStat[];
  sessions:          { category_id: string }[];
  plans:             SchoolPlan[];
  chapterMeta:       Record<string, ChapterMeta>;
  profileName:       string;
  primaryCategoryId: string;
}

const COUNTRY_LABEL: Record<string, string> = { KR: '🇰🇷 한국', CA: '🇨🇦 캐나다', UK: '🇬🇧 영국' };

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string | number; color: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm">
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${color}`}><Icon size={20} /></div>
      <div>
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <p className="text-xl font-bold leading-tight text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function ActionCard({ href, icon: Icon, iconBg, iconColor, accent, title, description, ctaLabel, ctaClass }: {
  href: string; icon: React.ElementType; iconBg: string; iconColor: string; accent: string;
  title: string; description: string; ctaLabel: string; ctaClass: string;
}) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-md transition-all duration-300 hover:shadow-xl">
      <div className={`h-1 bg-gradient-to-r ${accent}`} />
      <div className="flex flex-1 flex-col p-6">
        <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl ${iconBg} transition-transform duration-300 group-hover:scale-110`}>
          <Icon className={iconColor} size={24} />
        </div>
        <h3 className="mb-2 text-lg font-bold text-slate-900">{title}</h3>
        <p className="mb-6 flex-1 text-sm leading-6 text-slate-500">{description}</p>
        <Link href={href} className={`inline-flex items-center gap-2 self-start rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${ctaClass}`}>
          {ctaLabel}<ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}

function ExamCard({ exam }: { exam: LanguageExamCard }) {
  const isEssay = exam.kind === 'ESSAY';
  return (
    <div className="group flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-600">{exam.skill}</span>
        <span className={`rounded-lg border px-2 py-0.5 text-xs font-semibold
          ${isEssay ? 'border-amber-200 bg-amber-50 text-amber-600' : 'border-emerald-200 bg-emerald-50 text-emerald-600'}`}>
          {isEssay ? 'AI 첨삭' : '객관식'}
        </span>
      </div>
      <p className="flex-1 font-bold leading-snug text-slate-800 transition-colors group-hover:text-indigo-600">{exam.title}</p>
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span>{isEssay ? '✍️ 에세이 1문항' : `📋 ${exam.questionCount}문항`}</span>
        {exam.course && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">{exam.course}</span>}
      </div>
      <Link href={exam.href} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition-colors duration-200 hover:bg-indigo-600">
        {isEssay ? '시험 시작 (AI 첨삭) →' : '시험 시작 →'}
      </Link>
    </div>
  );
}

/* ── SCHOOL 글로벌 교과 대시보드 — 상단 마스터 필터(국가→학년→목적)를 구독해
   카드·통계·페이스메이커를 실시간 재계산하는 반응형 클라이언트 컴포넌트 ── */
export function SchoolDashboard({ exams, stats, sessions, plans, chapterMeta, profileName, primaryCategoryId }: Props) {
  const country = useCurriculumStore((s) => s.country);
  const grade   = useCurriculumStore((s) => s.grade);
  const stream  = useCurriculumStore((s) => s.stream);

  // 필터에 매칭되는 단원/카테고리 집합
  const { chapterIds, categoryIds } = useMemo(() => {
    const chapterIds = new Set<string>();
    const categoryIds = new Set<string>();
    for (const [cid, m] of Object.entries(chapterMeta)) {
      if ((!country || m.country === country) && (!grade || m.grade === grade) && (!stream || m.stream === stream)) {
        chapterIds.add(cid);
        categoryIds.add(m.category_id);
      }
    }
    return { chapterIds, categoryIds };
  }, [chapterMeta, country, grade, stream]);

  const filteredCards = useMemo(
    () => exams.filter((e) =>
      (!country || e.country === country) && (!grade || e.gradeLevel === grade) && (!stream || e.stream === stream)),
    [exams, country, grade, stream],
  );

  const statsF = useMemo(() => stats.filter((s) => chapterIds.has(s.chapter_id)), [stats, chapterIds]);
  const totalAttempts = statsF.reduce((a, s) => a + s.total_attempts, 0);
  const totalCorrect  = statsF.reduce((a, s) => a + s.correct_count, 0);
  const overallAcc    = totalAttempts === 0 ? '–' : `${Math.round((totalCorrect / totalAttempts) * 100)}%`;
  const weakCount     = statsF.filter((s) => s.accuracy_rate < 60).length;
  const sessionCount  = useMemo(() => sessions.filter((s) => categoryIds.has(s.category_id)).length, [sessions, categoryIds]);

  // 페이스메이커 — 필터된 카테고리 중 최신 플랜(plans는 updated_at desc 정렬)
  const pacemaker = useMemo(() => {
    const plan = plans.find((p) => categoryIds.has(p.category_id));
    let pm = { hasPlan: false, dDay: 0, pct: 0, done: 0, total: 0 };
    if (plan?.plan_content && plan.exam_date) {
      try {
        const parsed = JSON.parse(plan.plan_content) as InteractivePlan;
        const ms = parsed.milestones ?? [];
        const completed = plan.completed_items ?? {};
        const total = ms.length;
        const done  = ms.filter((m) => completed[m.id]).length;
        if (total > 0) {
          const { dDay } = computeStudyBudget(plan.exam_date, plan.availability_matrix ?? {});
          pm = { hasPlan: true, dDay, pct: Math.round((done / total) * 100), done, total };
        }
      } catch { /* 파싱 실패 → 가드 표시 */ }
    }
    return pm;
  }, [plans, categoryIds]);

  const repCat = [...categoryIds][0] ?? primaryCategoryId;
  const pathLabel = [country && (COUNTRY_LABEL[country] ?? country), grade, stream].filter(Boolean).join(' › ');

  return (
    <div className="space-y-8">
      {/* 페이스메이커 */}
      <PacemakerBanner name={profileName} {...pacemaker} />

      {/* 헤더 */}
      <div>
        <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-600">
          <Globe2 size={13} /> 글로벌 교과
        </p>
        <h1 className="text-3xl font-extrabold leading-tight text-slate-900">국내외 교과 과정</h1>
        <p className="mt-1 text-sm text-slate-400">
          {pathLabel ? <>상단 마스터 필터: <span className="font-semibold text-slate-600">{pathLabel}</span></> : '상단 필터에서 국가·학년·시험 목적을 선택해 과정을 좁혀보세요.'}
        </p>
      </div>

      {/* 요약 통계 (필터 스코프) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={BookOpen} label="완료 세션"   value={`${sessionCount}회`} color="bg-indigo-50 text-indigo-600" />
        <StatCard icon={Award}    label="전체 정답률" value={overallAcc}          color="bg-emerald-50 text-emerald-600" />
        <StatCard icon={Zap}      label="취약 단원"   value={`${weakCount}개`}    color="bg-rose-50 text-rose-500" />
      </div>

      {/* 핵심 액션 */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ActionCard
          href={`/student/diagnostic?category=${repCat}`}
          icon={ClipboardCheck} iconBg="bg-indigo-50" iconColor="text-indigo-600" accent="from-amber-500 to-orange-500"
          title="진단 및 평가" description="현재 실력을 측정하고 영역별 취약점을 분석합니다. 결과를 바탕으로 AI가 학습 계획을 설계합니다."
          ctaLabel="지금 시작하기" ctaClass="bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow-indigo-200 hover:shadow-md"
        />
        <ActionCard
          href={`/student/training?category=${repCat}`}
          icon={Target} iconBg="bg-emerald-50" iconColor="text-emerald-600" accent="from-emerald-400 to-teal-500"
          title="취약 단원 무한 훈련방" description="AI가 오답 기록을 분석해 취약 단원 문제를 실시간으로 생성합니다. 집중 훈련으로 등급을 끌어올리세요."
          ctaLabel="훈련방 입장" ctaClass="border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50 hover:shadow-emerald-100 hover:shadow-md"
        />
      </div>

      {/* 과목 카드 그리드 (필터 스코프) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="text-indigo-500" size={18} />
          <h2 className="text-lg font-bold text-slate-900">실전 모의고사</h2>
          <span className="ml-auto text-xs text-slate-400">{filteredCards.length}개 세트</span>
        </div>
        {filteredCards.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredCards.map((exam) => <ExamCard key={exam.id} exam={exam} />)}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-white p-10 text-center text-slate-400 shadow-sm">
            <FileText size={32} className="text-slate-300" />
            <p className="text-sm font-medium">선택한 교육 과정에 해당하는 모의고사가 없습니다.</p>
            <p className="text-xs">상단 마스터 필터 조건을 바꾸거나 초기화해 보세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}
