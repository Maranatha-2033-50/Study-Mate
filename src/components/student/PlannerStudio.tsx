'use client';

import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createClient } from '@/lib/supabase/client';
import { HelpTip } from '@/components/ui/HelpTip';
import { computeStudyBudget, WEEKDAYS } from '@/lib/planner-budget';
import {
  CalendarDays, RotateCcw, Sparkles, Clock, Target,
  CheckCircle2, Circle, ChevronLeft, ChevronRight, X, Wand2,
} from 'lucide-react';
import type { AvailabilityMatrix, AIStudyPlanRow, InteractivePlan, WeaknessStat } from '@/types';

const DOW_KR = ['일', '월', '화', '수', '목', '금', '토'];
const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const prettyDate = (s: string) => {
  const d = parseDate(s);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW_KR[d.getDay()]})`;
};
const DEFAULT_MATRIX: AvailabilityMatrix = { mon: 2, tue: 2, wed: 2, thu: 2, fri: 2, sat: 4, sun: 4 };

function MD({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p:  ({ children }) => <p className="text-sm text-slate-600 leading-7 mb-1.5">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-indigo-700">{children}</strong>,
        ul: ({ children }) => <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 text-sm text-slate-600">{children}</ol>,
        li: ({ children }) => <li className="leading-6">{children}</li>,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

/* ── 프리미엄 날짜 선택 모달 ──────────────────────────────── */
function CalendarModal({
  value, onSelect, onClose,
}: { value: string; onSelect: (d: string) => void; onClose: () => void }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const init = value ? parseDate(value) : today;
  const [view, setView] = useState({ y: init.getFullYear(), m: init.getMonth() });

  const first = new Date(view.y, view.m, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(view.y, view.m, i + 1)),
  ];

  const shift = (delta: number) => {
    const m = view.m + delta;
    setView({ y: view.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4"
         onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-sm p-5"
           onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => shift(-1)} className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500">
            <ChevronLeft size={18} />
          </button>
          <p className="text-base font-bold text-slate-800">{view.y}년 {view.m + 1}월</p>
          <button onClick={() => shift(1)} className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500">
            <ChevronRight size={18} />
          </button>
        </div>
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 mb-1.5">
          {DOW_KR.map((d, i) => (
            <div key={d} className={`text-center text-xs font-semibold py-1
              ${i === 0 ? 'text-rose-400' : i === 6 ? 'text-sky-400' : 'text-slate-400'}`}>{d}</div>
          ))}
        </div>
        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={`p${i}`} />;
            const past = d < today;
            const isSel = value === fmtDate(d);
            const isToday = d.getTime() === today.getTime();
            return (
              <button
                key={fmtDate(d)}
                disabled={past}
                onClick={() => { onSelect(fmtDate(d)); onClose(); }}
                className={`h-9 rounded-lg text-sm font-medium transition-colors
                  ${isSel ? 'bg-indigo-600 text-white font-bold'
                    : past ? 'text-slate-300 cursor-not-allowed'
                    : isToday ? 'text-indigo-600 font-bold ring-1 ring-indigo-200 hover:bg-indigo-50'
                    : 'text-slate-700 hover:bg-indigo-50'}`}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
        <button onClick={onClose} className="mt-4 w-full py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50">
          닫기
        </button>
      </div>
    </div>
  );
}

/* ── 메인 ─────────────────────────────────────────────────── */
interface Props {
  categoryId:    string;
  categoryTitle: string;
  weakStats:     WeaknessStat[];
  initialPlan:   AIStudyPlanRow | null;
}

export function PlannerStudio({ categoryId, categoryTitle, weakStats, initialPlan }: Props) {
  const supabase = createClient();

  const [plan, setPlan] = useState<AIStudyPlanRow | null>(initialPlan);
  const hasPlan = !!plan?.plan_content;
  const [mode, setMode] = useState<'setup' | 'dashboard'>(hasPlan ? 'dashboard' : 'setup');

  // setup state (재설정 시 기존 값 프리필)
  const [examDate, setExamDate] = useState(plan?.exam_date ?? '');
  const [matrix, setMatrix] = useState<AvailabilityMatrix>({
    ...DEFAULT_MATRIX, ...(plan?.availability_matrix ?? {}),
  });
  const [calOpen, setCalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const weeklyTotal = WEEKDAYS.reduce((s, d) => s + (Number(matrix[d.key]) || 0), 0);
  const preview = examDate ? computeStudyBudget(examDate, matrix) : null;

  const weakChips = weakStats.slice(0, 5);

  const generate = async () => {
    if (!examDate) { setError('목표 시험일을 선택해 주세요.'); return; }
    if (!categoryId) { setError('카테고리가 선택되지 않았습니다.'); return; }

    // ── [Paywall Hook — 플랜 생성 완료 콜백 결제 유도 지점] ──────────────────
    //  무료체험(FREE_TRIAL) 사용자가 플랜 생성을 시도할 때 결제 모달을 띄울 자리.
    //  결제 퍼널 개통 시 아래 분기만 활성화하면 된다(엔타이틀먼트는 서버에서 검증):
    //    if (subscription_status !== 'PREMIUM' && is_plan_locked) {
    //      setPaywallOpen(true);   // <PaywallModal/> 만 얹으면 동작
    //      return;
    //    }
    //  서버(/api/planner)도 402(UPGRADE_REQUIRED)를 반환하도록 이미 훅이 준비돼 있다.

    setError(''); setGenerating(true);
    try {
      const res = await fetch('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_id: categoryId, category_title: categoryTitle,
          exam_date: examDate, availability_matrix: matrix,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? '생성 실패');
      }
      const { plan: saved } = await res.json();
      setPlan(saved);
      setMode('dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 플랜 생성 중 오류가 발생했습니다.');
    } finally {
      setGenerating(false);
    }
  };

  // ── SETUP 화면 ──
  if (mode === 'setup') {
    return (
      <div className="space-y-6">
        {/* 1. 시험 날짜 */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center">1</span>
            <h3 className="font-bold text-slate-800">목표 시험일 (D-Day)</h3>
            <HelpTip
              align="left"
              text="시험 당일 날짜를 선택하세요. 오늘부터 시험일까지 남은 일수(D-Day)를 기준으로 AI가 전체 학습 예산과 마일스톤 일정을 역산합니다."
            />
          </div>
          <button
            onClick={() => setCalOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-slate-200
                       hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors text-left"
          >
            <CalendarDays className="text-indigo-500" size={20} />
            {examDate ? (
              <span className="text-sm font-semibold text-slate-800">{prettyDate(examDate)}</span>
            ) : (
              <span className="text-sm text-slate-400">날짜를 선택하세요</span>
            )}
            {preview && (
              <span className="ml-auto text-sm font-bold text-indigo-600">D-{preview.dDay}</span>
            )}
          </button>
        </section>

        {/* 2. 요일별 가용 시간 */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center">2</span>
            <h3 className="font-bold text-slate-800">요일별 가용 학습 시간</h3>
            <HelpTip
              align="left"
              text="요일마다 학습에 쓸 수 있는 시간을 시간 단위(0.5 단위 가능)로 입력하세요. 주간 합계 × 남은 주차로 총 학습 예산(Study Budget)이 계산됩니다."
            />
            <span className="ml-auto text-xs text-slate-400">단위: 시간/일</span>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {WEEKDAYS.map((d) => (
              <div key={d.key} className="flex flex-col items-center gap-1.5">
                <span className={`text-xs font-semibold
                  ${d.key === 'sat' ? 'text-sky-500' : d.key === 'sun' ? 'text-rose-400' : 'text-slate-500'}`}>
                  {d.label}
                </span>
                <input
                  type="number" min={0} max={24} step={0.5}
                  value={matrix[d.key]}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(24, Number(e.target.value) || 0));
                    setMatrix((m) => ({ ...m, [d.key]: v }));
                  }}
                  className="w-full text-center px-1 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-700
                             focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            ))}
          </div>

          {/* 예산 미리보기 */}
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
            <span className="flex items-center gap-1.5 text-sm text-slate-500">
              <Clock size={15} className="text-slate-400" /> 주간 {weeklyTotal}시간
            </span>
            {preview && (
              <span className="flex items-center gap-1.5 text-sm font-bold text-indigo-600">
                <Target size={15} /> 총 학습 가용 시간 {preview.totalHours}시간 (Study Budget)
              </span>
            )}
          </div>
        </section>

        {/* 취약 단원 미리보기 */}
        {weakChips.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <p className="text-xs font-semibold text-slate-500 mb-2">AI가 집중 공략할 취약 단원</p>
            <div className="flex flex-wrap gap-2">
              {weakChips.map((w) => (
                <span key={w.chapter_id} className="text-xs bg-rose-50 text-rose-600 px-2.5 py-1 rounded-full border border-rose-200">
                  {w.level_2} · {w.accuracy_rate}%
                </span>
              ))}
            </div>
          </section>
        )}

        {error && <p className="text-sm text-rose-500">{error}</p>}

        <button
          onClick={generate}
          disabled={generating || !examDate}
          className="w-full inline-flex items-center justify-center gap-2 py-4 rounded-xl
                     bg-indigo-600 text-white text-sm font-bold
                     hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {generating
            ? 'AI가 Study Budget을 분석해 로드맵을 설계 중…'
            : <><Wand2 size={17} /> 가용 시간 기반 AI 플랜 생성</>}
        </button>

        {calOpen && <CalendarModal value={examDate} onSelect={setExamDate} onClose={() => setCalOpen(false)} />}
      </div>
    );
  }

  // ── DASHBOARD 화면 ──
  return <PlanDashboard plan={plan!} onReset={() => { setError(''); setMode('setup'); }} />;
}

/* ── 인터랙티브 대시보드 (체크박스·진행률) ─────────────────── */
function PlanDashboard({ plan, onReset }: { plan: AIStudyPlanRow; onReset: () => void }) {
  const supabase = createClient();
  const parsed = useMemo<InteractivePlan>(() => {
    try { return JSON.parse(plan.plan_content ?? '{}'); }
    catch { return { summary: '', encouragement: '', milestones: [] }; }
  }, [plan.plan_content]);

  const [completed, setCompleted] = useState<Record<string, boolean>>(plan.completed_items ?? {});

  const budget = plan.exam_date ? computeStudyBudget(plan.exam_date, plan.availability_matrix ?? {}) : null;
  const total = parsed.milestones.length;
  const done  = parsed.milestones.filter((m) => completed[m.id]).length;
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100);

  const toggle = async (id: string) => {
    const next = { ...completed, [id]: !completed[id] };
    setCompleted(next);
    await supabase
      .from('ai_study_plans')
      .update({ completed_items: next, updated_at: new Date().toISOString() })
      .eq('id', plan.id);
  };

  return (
    <div className="space-y-6">
      {/* 헤더: 시험일 + 예산 + 재설정 */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white p-6 shadow-lg">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-indigo-200 text-xs font-semibold uppercase tracking-widest mb-1">
              <Target size={13} /> Study Budget Roadmap
            </p>
            {plan.exam_date && (
              <p className="text-lg font-bold">{prettyDate(plan.exam_date)} 시험</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm text-indigo-100">
              {budget && <span className="font-bold text-white">D-{budget.dDay}</span>}
              {budget && <span>· 총 가용 {budget.totalHours}시간</span>}
            </div>
          </div>
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25
                       text-white text-sm font-semibold transition-colors"
          >
            <RotateCcw size={15} /> 스케줄 재설정
          </button>
        </div>

        {/* 진행률 바 */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-indigo-100 mb-1.5">
            <span>달성 마일스톤 {done}/{total}</span>
            <span className="font-bold text-white">{pct}%</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2.5">
            <div className="h-2.5 rounded-full bg-white transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* 전략 요약 */}
      {parsed.summary && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <p className="flex items-center gap-1.5 text-sm font-bold text-slate-800 mb-2">
            <Sparkles size={15} className="text-indigo-500" /> 전략 요약
          </p>
          <p className="text-sm text-slate-600 leading-7">{parsed.summary}</p>
        </div>
      )}

      {/* 마일스톤 체크리스트 */}
      <div className="space-y-3">
        {parsed.milestones.map((m, i) => {
          const checked = !!completed[m.id];
          return (
            <div key={m.id}
              className={`rounded-2xl border bg-white p-5 transition-colors
                ${checked ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-100 shadow-sm'}`}>
              <div className="flex items-start gap-3">
                <button onClick={() => toggle(m.id)} className="mt-0.5 flex-none">
                  {checked
                    ? <CheckCircle2 className="text-emerald-500" size={22} />
                    : <Circle className="text-slate-300 hover:text-indigo-400 transition-colors" size={22} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-[11px] font-bold text-indigo-500">STEP {i + 1}</span>
                    <span className="text-xs font-medium text-slate-400">{m.day_range}</span>
                    <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      {m.hours}시간
                    </span>
                  </div>
                  <h4 className={`font-bold mb-1.5 ${checked ? 'text-emerald-700 line-through decoration-emerald-300' : 'text-slate-800'}`}>
                    {m.title}
                  </h4>
                  <MD>{m.detail}</MD>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 격려 메시지 */}
      {parsed.encouragement && (
        <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-white p-6">
          <p className="flex items-center gap-1.5 text-sm font-bold text-indigo-700 mb-1.5">
            <Sparkles size={15} /> AI 격려 메시지
          </p>
          <p className="text-sm text-slate-700 leading-7">{parsed.encouragement}</p>
        </div>
      )}
    </div>
  );
}
