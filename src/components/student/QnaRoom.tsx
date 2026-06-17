'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  MessageCircleQuestion, ChevronRight, ChevronDown, NotebookPen,
  Send, FileText, AlertTriangle, Brain, ArrowLeft,
} from 'lucide-react';
import type { TutorQuestion, TutorMessage } from '@/types';

const nl = (s: string) => s.replace(/\\n/g, '\n');
const eq = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();

const STATUS: Record<string, { label: string; cls: string }> = {
  OPEN:     { label: '답변 대기', cls: 'bg-amber-100 text-amber-700' },
  ANSWERED: { label: '답변 완료', cls: 'bg-emerald-100 text-emerald-700' },
  CLOSED:   { label: '종료',      cls: 'bg-slate-100 text-slate-500' },
};

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

/* ── 컨텍스트 아코디언 배너 (문제 / 내 오답 / 정답 해설 / AI 분석) ── */
function ContextBanner({ q }: { q: TutorQuestion }) {
  const c = q.wrong_context;
  const optionKeys = c.options ? Object.keys(c.options) : [];
  const isObjective = !!c.options;

  return (
    <div className="space-y-2 border-b border-slate-100 bg-slate-50/70 p-4">
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        선생님 참고용 — {c.category_title} · {c.level_1} › {c.level_2} · 난이도 {c.difficulty}
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
                  {myWrong && <span className="text-xs font-bold text-rose-500">내 오답 ✕</span>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1.5">
            <p><span className="text-xs text-slate-400">내가 쓴 답: </span><span className="font-semibold text-rose-600">{c.user_wrong_answer || '(미답)'}</span></p>
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

/* ── 1:1 선생님 문의방 ── */
export function QnaRoom({ questions, userId }: { questions: TutorQuestion[]; userId: string }) {
  const supabase = createClient();

  const [selectedId, setSelectedId] = useState<string | null>(questions[0]?.id ?? null);
  const [messages, setMessages]     = useState<TutorMessage[]>([]);
  const [loading, setLoading]       = useState(false);
  const [input, setInput]           = useState('');
  const [sending, setSending]       = useState(false);

  const selected = questions.find((q) => q.id === selectedId) ?? null;

  // 선택된 질문의 메시지 타임라인 로드
  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    let alive = true;
    setLoading(true);
    supabase
      .from('tutor_messages')
      .select('id, question_id, sender_id, sender_role, body, created_at')
      .eq('question_id', selectedId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (alive) { setMessages((data ?? []) as TutorMessage[]); setLoading(false); }
      });
    return () => { alive = false; };
  }, [selectedId, supabase]);

  const send = async () => {
    if (!selected || !input.trim()) return;
    setSending(true);
    const body = input.trim();
    const { data, error } = await supabase
      .from('tutor_messages')
      .insert({ question_id: selected.id, sender_id: userId, sender_role: 'student', body })
      .select('id, question_id, sender_id, sender_role, body, created_at')
      .single();
    setSending(false);
    if (!error && data) {
      setMessages((prev) => [...prev, data as TutorMessage]);
      setInput('');
    }
  };

  if (questions.length === 0) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-100 bg-white p-12 text-center text-slate-400">
          <MessageCircleQuestion size={40} className="text-slate-300" />
          <p className="text-sm font-medium">아직 질문한 내용이 없습니다.</p>
          <Link href="/student/incorrect" className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
            <NotebookPen size={15} /> 오답 보관함에서 질문하기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Header />

      <div className="grid h-[calc(100vh-16rem)] grid-cols-1 gap-5 lg:grid-cols-[38%_1fr]">
        {/* ── 좌: 질문 피드 ── */}
        <div className="space-y-2.5 overflow-y-auto pr-1">
          {questions.map((q) => {
            const sel = q.id === selectedId;
            const st = STATUS[q.status] ?? STATUS.OPEN;
            return (
              <button
                key={q.id}
                onClick={() => setSelectedId(q.id)}
                className={`w-full rounded-2xl border bg-white px-4 py-3.5 text-left transition-all
                  ${sel ? 'border-indigo-400 shadow-md ring-2 ring-indigo-100'
                        : 'border-slate-100 shadow-sm hover:border-indigo-200 hover:shadow-md'}`}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                  <span className="truncate text-xs font-medium text-slate-400">{q.wrong_context.level_1} › {q.wrong_context.level_2}</span>
                  <ChevronRight size={14} className={`ml-auto flex-none ${sel ? 'text-indigo-500' : 'text-slate-300'}`} />
                </div>
                <p className="line-clamp-2 text-sm font-medium leading-6 text-slate-700">
                  {nl(q.wrong_context.question_text).replace(/[#*`>]/g, '').slice(0, 80)}
                </p>
                <p className="mt-1.5 text-xs text-slate-400">{new Date(q.created_at).toLocaleDateString('ko-KR')}</p>
              </button>
            );
          })}
        </div>

        {/* ── 우: 대화방 ── */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          {!selected ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-slate-300">
              <MessageCircleQuestion size={44} />
              <p className="text-sm font-medium text-slate-400">왼쪽에서 질문을 선택하세요.</p>
            </div>
          ) : (
            <>
              {/* 상단 고정 컨텍스트 아코디언 */}
              <div className="max-h-[46%] flex-none overflow-y-auto">
                <ContextBanner q={selected} />
              </div>

              {/* 메시지 타임라인 */}
              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {loading ? (
                  <p className="text-center text-sm text-slate-400">불러오는 중…</p>
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-slate-400">아직 주고받은 메시지가 없습니다. 첫 질문을 남겨 보세요.</p>
                ) : (
                  messages.map((m) => {
                    const mine = m.sender_id === userId;
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-6
                          ${mine ? 'rounded-br-sm bg-indigo-600 text-white'
                                 : 'rounded-bl-sm border border-slate-200 bg-slate-50 text-slate-700'}`}>
                          <p className={`mb-0.5 text-[10px] font-bold uppercase tracking-wider ${mine ? 'text-indigo-200' : 'text-slate-400'}`}>
                            {m.sender_role === 'tutor' ? '선생님' : '나'}
                          </p>
                          <p className="whitespace-pre-wrap">{m.body}</p>
                          <p className={`mt-1 text-[10px] ${mine ? 'text-indigo-200' : 'text-slate-400'}`}>
                            {new Date(m.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* 입력 */}
              <div className="flex-none border-t border-slate-100 p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }}
                    rows={2}
                    placeholder="추가 질문을 입력하세요 (Ctrl/⌘+Enter 전송)"
                    className="flex-1 resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm
                               focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                  <button
                    onClick={send}
                    disabled={sending || !input.trim()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm
                               font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Send size={15} /> {sending ? '전송…' : '전송'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-indigo-500">
          <MessageCircleQuestion size={13} /> 1:1 Tutor Q&amp;A
        </p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight text-slate-900">선생님 문의방</h1>
        <p className="mt-0.5 text-sm text-slate-400">오답에 대해 선생님과 1:1로 주고받은 질문을 확인하세요.</p>
      </div>
      <Link
        href="/student/incorrect"
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm
                   font-semibold text-slate-500 transition-colors hover:border-indigo-300 hover:text-indigo-600"
      >
        <ArrowLeft size={15} /> 오답 보관함
      </Link>
    </div>
  );
}
