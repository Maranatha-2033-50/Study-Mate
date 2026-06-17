'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Globe2, FileText, Filter, RotateCcw } from 'lucide-react';
import { useCurriculumStore } from '@/stores/curriculumStore';
import type { LanguageExamCard } from '@/types';

/* 국가 코드 → 표시 라벨 */
const COUNTRY_LABEL: Record<string, string> = {
  KR: '🇰🇷 한국',
  CA: '🇨🇦 캐나다',
  UK: '🇬🇧 영국',
};
const countryLabel = (c: string) => COUNTRY_LABEL[c] ?? c;

const uniq = (xs: (string | null | undefined)[]) =>
  [...new Set(xs.filter((x): x is string => !!x))];

/* ── 모의고사 카드 ── */
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
      </div>
      <Link
        href={exam.href}
        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition-colors duration-200 hover:bg-indigo-600"
      >
        {isEssay ? '시험 시작 (AI 첨삭) →' : '시험 시작 →'}
      </Link>
    </div>
  );
}

/* ── 단계 드롭다운 (국가 → 학년/과정 → 목적) ── */
function Step({
  n, label, value, options, onChange, render, disabled,
}: {
  n: number; label: string; value: string; options: string[];
  onChange: (v: string) => void; render?: (v: string) => string; disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        <span className="flex h-4 w-4 items-center justify-center rounded bg-indigo-100 text-[10px] font-bold text-indigo-600">{n}</span>
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700
                   transition-colors focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100
                   disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
      >
        <option value="">전체</option>
        {options.map((o) => <option key={o} value={o}>{render ? render(o) : o}</option>)}
      </select>
    </label>
  );
}

/* ── 글로벌 교과 4단계 트리 탐색기 ──
   국가 → 학년/과정 → 목적(스트림)은 여기서 선택, 최종 [세부 과목(Course)]은
   상단 GNB 탭으로 publish되어 양방향 동기화된다. */
export function CurriculumExplorer({ exams }: { exams: LanguageExamCard[] }) {
  // country/grade/stream 은 zustand 외 로컬 상태로 충분하지만, GNB 동기화를 위해
  // course(=activeCourse)는 스토어로 끌어올린다.
  const activeCourse = useCurriculumStore((s) => s.activeCourse);
  const setCourses = useCurriculumStore((s) => s.setCourses);
  const setActiveCourse = useCurriculumStore((s) => s.setActiveCourse);

  // 국가/학년/목적 선택 (로컬)
  const [country, setCountry] = useState('');
  const [grade,   setGrade]   = useState('');
  const [stream,  setStream]  = useState('');

  const countries = useMemo(() => uniq(exams.map((e) => e.country)), [exams]);
  const grades = useMemo(
    () => uniq(exams.filter((e) => !country || e.country === country).map((e) => e.gradeLevel)),
    [exams, country],
  );
  const streams = useMemo(
    () => uniq(exams
      .filter((e) => (!country || e.country === country) && (!grade || e.gradeLevel === grade))
      .map((e) => e.stream)),
    [exams, country, grade],
  );
  // 현재 국가/학년/목적 조건의 세부 과목 → GNB로 publish
  const courses = useMemo(
    () => uniq(exams
      .filter((e) => (!country || e.country === country) && (!grade || e.gradeLevel === grade) && (!stream || e.stream === stream))
      .map((e) => e.course)),
    [exams, country, grade, stream],
  );

  useEffect(() => { setCourses(courses); }, [courses, setCourses]);

  // GNB에서 고른 과목이 현재 옵션에 없으면 무시(전체)
  const effCourse = activeCourse && courses.includes(activeCourse) ? activeCourse : null;

  const filtered = useMemo(
    () => exams.filter((e) =>
      (!country || e.country === country) &&
      (!grade   || e.gradeLevel === grade) &&
      (!stream  || e.stream === stream) &&
      (!effCourse || e.course === effCourse)),
    [exams, country, grade, stream, effCourse],
  );

  const reset = () => { setCountry(''); setGrade(''); setStream(''); setActiveCourse(null); };
  const active = country || grade || stream || effCourse;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Globe2 className="text-indigo-500" size={18} />
        <h2 className="text-lg font-bold text-slate-900">글로벌 교과 탐색</h2>
        <span className="ml-auto text-xs text-slate-400">{filtered.length}개 세트</span>
      </div>

      {/* 3단계 캐스케이딩 (최종 과목은 상단 GNB 탭) */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <Filter size={13} className="text-indigo-400" /> 국가 → 학년/과정 → 시험 목적을 선택하면, 세부 과목이 상단 탭에 나타납니다
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Step n={1} label="국가" value={country} options={countries} render={countryLabel}
                onChange={(v) => { setCountry(v); setGrade(''); setStream(''); setActiveCourse(null); }} />
          <Step n={2} label="학년 / 과정" value={grade} options={grades} disabled={grades.length === 0}
                onChange={(v) => { setGrade(v); setStream(''); setActiveCourse(null); }} />
          <Step n={3} label="시험 목적 / 스트림" value={stream} options={streams} disabled={streams.length === 0}
                onChange={(v) => { setStream(v); setActiveCourse(null); }} />
        </div>
        {active && (
          <button
            onClick={reset}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition-colors hover:text-indigo-600"
          >
            <RotateCcw size={12} /> 필터 초기화
          </button>
        )}
      </div>

      {/* 결과 그리드 */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((exam) => <ExamCard key={exam.id} exam={exam} />)}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-white p-10 text-center text-slate-400">
          <FileText size={32} className="text-slate-300" />
          <p className="text-sm font-medium">선택한 조건에 해당하는 모의고사가 없습니다.</p>
          <p className="text-xs">상단 과목 탭을 [전체]로 바꾸거나 필터를 초기화해 보세요.</p>
        </div>
      )}
    </div>
  );
}
