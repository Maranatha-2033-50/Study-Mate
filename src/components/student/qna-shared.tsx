'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ChevronRight, ChevronDown, FileText, AlertTriangle, Brain,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { TutorQuestion, TutorMessage } from '@/types';

export const nl = (s: string) => s.replace(/\\n/g, '\n');
const eq = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();

export const QUESTION_STATUS: Record<string, { label: string; cls: string }> = {
  OPEN:     { label: '답변 대기', cls: 'bg-amber-100 text-amber-700' },
  ANSWERED: { label: '답변 완료', cls: 'bg-emerald-100 text-emerald-700' },
  CLOSED:   { label: '종료',      cls: 'bg-slate-100 text-slate-500' },
};

/* ── Supabase Realtime: 특정 질문 스레드의 새 메시지 INSERT 구독 ──
   questionId 변경/언마운트 시 채널을 반드시 해제해 메모리 누수를 방지한다. */
export function useRealtimeMessages(questionId: string | null, onInsert: (m: TutorMessage) => void) {
  const [supabase] = useState(() => createClient());
  const cb = useRef(onInsert);
  cb.current = onInsert;

  useEffect(() => {
    if (!questionId) return;
    const channel = supabase
      .channel(`qna-thread-${questionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tutor_messages', filter: `question_id=eq.${questionId}` },
        (payload) => cb.current(payload.new as TutorMessage),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [questionId, supabase]);
}

/* ── 접이식 컨텍스트 섹션 ── */
function Section({
  icon: Icon, title, openByDefault = false, children,
}: { icon: React.ElementType; title: string; openByDefault?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(openByDefault);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        <Icon size={15} className="text-indigo-500" />
        {title}
        {open ? <ChevronDown size={15} className="ml-auto text-slate-400" />
              : <ChevronRight size={15} className="ml-auto text-slate-400" />}
      </button>
      {open && <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-600">{children}</div>}
    </div>
  );
}

/* ── 컨텍스트 아코디언 배너 (문제 / 오답·정답 / AI 분석) — 학생·교사 공용 ── */
export function ContextBanner({ q }: { q: TutorQuestion }) {
  const c = q.wrong_context;
  const optionKeys = c.options ? Object.keys(c.options) : [];
  const isObjective = !!c.options;

  return (
    <div className="space-y-2 border-b border-slate-100 bg-slate-50/70 p-4">
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {c.category_title} · {c.level_1} › {c.level_2} · 난이도 {c.difficulty}
      </p>

      <Section icon={FileText} title="당시 풀었던 문제 문항" openByDefault>
        <p className="whitespace-pre-wrap leading-7">{nl(c.question_text).replace(/[#*`>]/g, '')}</p>
      </Section>

      <Section icon={AlertTriangle} title="학생이 찍은 오답 / 정답">
        {isObjective ? (
          <div className="space-y-1.5">
            {optionKeys.map((k) => {
              const val = (c.options as unknown as Record<string, string>)[k];
              const correct = eq(k, c.correct_answer);
              const myWrong = eq(k, c.user_wrong_answer) && !correct;
              return (
                <div key={k}
                  className={`flex items-start gap-2 rounded-lg border px-3 py-1.5
                    ${correct ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                      : myWrong ? 'border-rose-300 bg-rose-50 text-rose-900'
                      : 'border-slate-200 bg-white text-slate-500'}`}>
                  <span className="font-bold">{k}</span>
                  <span className="flex-1">{val}</span>
                  {correct && <span className="text-xs font-bold text-emerald-600">정답 ✓</span>}
                  {myWrong && <span className="text-xs font-bold text-rose-500">학생 오답 ✕</span>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1.5">
            <p><span className="text-xs text-slate-400">학생 답: </span><span className="font-semibold text-rose-600">{c.user_wrong_answer || '(미답)'}</span></p>
            <p><span className="text-xs text-slate-400">정답: </span><span className="font-semibold text-emerald-700">{c.correct_answer}</span></p>
          </div>
        )}
      </Section>

      {q.ai_analysis && (
        <Section icon={Brain} title="정답 해설 / AI 취약점 분석">
          <p className="whitespace-pre-wrap leading-7">{nl(q.ai_analysis).replace(/[#*`>]/g, '')}</p>
        </Section>
      )}
    </div>
  );
}

/* ── 메시지 타임라인 (말풍선) — 본인(userId) 우측, 상대 좌측 ── */
export function MessageList({ messages, userId }: { messages: TutorMessage[]; userId: string }) {
  if (messages.length === 0) {
    return <p className="text-center text-sm text-slate-400">아직 주고받은 메시지가 없습니다.</p>;
  }
  return (
    <>
      {messages.map((m) => {
        const mine = m.sender_id === userId;
        const who = mine ? '나' : m.sender_role === 'tutor' ? '선생님' : '학생';
        return (
          <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-6
              ${mine ? 'rounded-br-sm bg-indigo-600 text-white'
                     : 'rounded-bl-sm border border-slate-200 bg-slate-50 text-slate-700'}`}>
              <p className={`mb-0.5 text-[10px] font-bold uppercase tracking-wider ${mine ? 'text-indigo-200' : 'text-slate-400'}`}>
                {who}
              </p>
              <p className="whitespace-pre-wrap">{m.body}</p>
              <p className={`mt-1 text-[10px] ${mine ? 'text-indigo-200' : 'text-slate-400'}`}>
                {new Date(m.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        );
      })}
    </>
  );
}
