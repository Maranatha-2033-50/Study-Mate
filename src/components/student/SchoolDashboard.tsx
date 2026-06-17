'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardCheck, Target, ChevronRight, FileText, BookOpen, Award, Zap, Globe2, Sparkles, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { useCurriculumStore } from '@/stores/curriculumStore';
import { PacemakerBanner } from '@/components/student/PacemakerBanner';
import { computeStudyBudget } from '@/lib/planner-budget';
import { schoolNode } from '@/lib/domain';
import type { AvailabilityMatrix, InteractivePlan } from '@/types';

export interface SchoolStat {
  chapter_id: string; category_id: string; level_1: string; level_2: string;
  total_attempts: number; correct_count: number; accuracy_rate: number;
}
export interface SchoolPlan {
  category_id: string; plan_content: string | null; exam_date: string | null;
  completed_items: Record<string, boolean>; availability_matrix: AvailabilityMatrix; updated_at: string;
}
export interface ChapterMeta { country: string | null; grade: string | null; stream: string | null; category_id: string }

interface Props {
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

export function SchoolDashboard({ stats, sessions, plans, chapterMeta, profileName, primaryCategoryId }: Props) {
  const router = useRouter();
  const country = useCurriculumStore((s) => s.country);
  const grade   = useCurriculumStore((s) => s.grade);
  const stream  = useCurriculumStore((s) => s.stream);

  const [generating, setGenerating] = useState<string | null>(null); // `${course}|${unit}`
  const [error, setError] = useState('');

  /* ── 필터 스코프 통계 (DB 단원 메타 기준) ── */
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

  const statsF = useMemo(() => stats.filter((s) => chapterIds.has(s.chapter_id)), [stats, chapterIds]);
  const totalAttempts = statsF.reduce((a, s) => a + s.total_attempts, 0);
  const totalCorrect  = statsF.reduce((a, s) => a + s.correct_count, 0);
  const overallAcc    = totalAttempts === 0 ? '–' : `${Math.round((totalCorrect / totalAttempts) * 100)}%`;
  const weakCount     = statsF.filter((s) => s.accuracy_rate < 60).length;
  const sessionCount  = useMemo(() => sessions.filter((s) => categoryIds.has(s.category_id)).length, [sessions, categoryIds]);

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
      } catch { /* 가드 */ }
    }
    return pm;
  }, [plans, categoryIds]);

  const repCat = [...categoryIds][0] ?? primaryCategoryId;
  const pathLabel = [country && (COUNTRY_LABEL[country] ?? country), grade, stream].filter(Boolean).join(' › ');
  const node = (country && grade && stream) ? schoolNode(country, grade, stream) : undefined;

  /* ── 온디맨드 출제: 캐시 조회 또는 AI 생성 후 시험장 진입 ── */
  const startUnit = async (course: string, unit: string) => {
    setError('');
    setGenerating(`${course}|${unit}`);
    try {
      const res = await fetch('/api/ai/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country, grade, stream, course, unit }),
      });
      const data = await res.json();
      if (!res.ok || !data.chapter_id) throw new Error(data.error ?? '생성 실패');
      router.push(`/student/diagnostic?category=${data.category_id}&chapter=${data.chapter_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 출제 중 오류가 발생했습니다.');
      setGenerating(null);
    }
  };

  return (
    <div className="space-y-8">
      <PacemakerBanner name={profileName} {...pacemaker} />

      <div>
        <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-600">
          <Globe2 size={13} /> 글로벌 교과
        </p>
        <h1 className="text-3xl font-extrabold leading-tight text-slate-900">국내외 교과 과정</h1>
        <p className="mt-1 text-sm text-slate-400">
          {pathLabel ? <>마스터 필터: <span className="font-semibold text-slate-600">{pathLabel}</span></> : '상단 필터에서 국가·학년·시험 목적을 선택해 과정을 좁혀보세요.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={BookOpen} label="완료 세션"   value={`${sessionCount}회`} color="bg-indigo-50 text-indigo-600" />
        <StatCard icon={Award}    label="전체 정답률" value={overallAcc}          color="bg-emerald-50 text-emerald-600" />
        <StatCard icon={Zap}      label="취약 단원"   value={`${weakCount}개`}    color="bg-rose-50 text-rose-500" />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ActionLink href={`/student/diagnostic?category=${repCat}`} icon={ClipboardCheck} accent="from-amber-500 to-orange-500"
          iconBg="bg-indigo-50" iconColor="text-indigo-600" title="진단 및 평가"
          desc="현재 실력을 측정하고 영역별 취약점을 분석합니다." cta="지금 시작하기"
          ctaClass="bg-indigo-600 text-white hover:bg-indigo-700" />
        <ActionLink href={`/student/training?category=${repCat}`} icon={Target} accent="from-emerald-400 to-teal-500"
          iconBg="bg-emerald-50" iconColor="text-emerald-600" title="취약 단원 무한 훈련방"
          desc="AI가 오답을 분석해 취약 단원 문제를 실시간 생성합니다." cta="훈련방 입장"
          ctaClass="border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50" />
      </div>

      {/* 과목/단원 카드 — 글로벌 교과 트리(config) 기반, 무문항 단원은 AI 온디맨드 출제 */}
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <FileText className="text-indigo-500" size={18} />
          <h2 className="text-lg font-bold text-slate-900">과목 · 단원</h2>
        </div>

        {!node ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-400">
            <Globe2 size={32} className="text-slate-300" />
            <p className="text-sm font-medium">상단 마스터 필터에서 국가 → 학년/과정 → 시험 목적을 모두 선택하세요.</p>
            <p className="text-xs">선택한 교육과정의 과목·단원이 여기에 나타납니다.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {node.courses.map((c) => (
              <div key={c.course}>
                <p className="mb-2.5 text-sm font-bold text-slate-700">{c.course}</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {c.units.map((unit) => {
                    const busy = generating === `${c.course}|${unit}`;
                    return (
                      <div key={unit} className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-600">{c.course}</span>
                          <span className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-600">
                            <Sparkles size={11} /> AI 출제
                          </span>
                        </div>
                        <p className="flex-1 font-bold leading-snug text-slate-800">{unit}</p>
                        <button
                          onClick={() => startUnit(c.course, unit)}
                          disabled={!!generating}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-600 disabled:opacity-50"
                        >
                          {busy ? '출제 중…' : <><Wand2 size={14} /> 시험 시작</>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        {error && <p className="text-sm text-rose-500">{error}</p>}
      </div>

      {/* 온디맨드 생성 프로그레스 오버레이 */}
      {generating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
              <Sparkles size={26} className="animate-pulse" />
            </div>
            <p className="text-base font-extrabold text-slate-900">AI가 킬러 문항을 실시간 출제 중입니다…</p>
            <p className="mt-1.5 text-sm text-slate-500">
              {pathLabel} 교육과정에 맞춘 객관식 5문항을 생성하고 있어요. 약 5~7초 소요됩니다.
            </p>
            <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-1.5 w-1/2 animate-pulse rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionLink({ href, icon: Icon, iconBg, iconColor, accent, title, desc, cta, ctaClass }: {
  href: string; icon: React.ElementType; iconBg: string; iconColor: string; accent: string;
  title: string; desc: string; cta: string; ctaClass: string;
}) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-md transition-all duration-300 hover:shadow-xl">
      <div className={`h-1 bg-gradient-to-r ${accent}`} />
      <div className="flex flex-1 flex-col p-6">
        <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl ${iconBg} transition-transform duration-300 group-hover:scale-110`}>
          <Icon className={iconColor} size={24} />
        </div>
        <h3 className="mb-2 text-lg font-bold text-slate-900">{title}</h3>
        <p className="mb-6 flex-1 text-sm leading-6 text-slate-500">{desc}</p>
        <Link href={href} className={`inline-flex items-center gap-2 self-start rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm transition-all duration-200 ${ctaClass}`}>
          {cta}<ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
