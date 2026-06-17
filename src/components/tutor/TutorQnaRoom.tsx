'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Inbox, ChevronRight, Send, User } from 'lucide-react';
import { ContextBanner, MessageList, useRealtimeMessages, QUESTION_STATUS, nl } from '@/components/student/qna-shared';
import type { TutorQuestion, TutorMessage } from '@/types';

export interface TutorInboxQuestion extends TutorQuestion {
  studentName: string;
}

const STATUS_RANK: Record<string, number> = { OPEN: 0, ANSWERED: 1, CLOSED: 2 };

/* ── 교사 전용 Q&A 수신함 ── */
export function TutorQnaRoom({ questions: initial, userId }: { questions: TutorInboxQuestion[]; userId: string }) {
  const [supabase] = useState(() => createClient());

  const [questions, setQuestions] = useState<TutorInboxQuestion[]>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null);
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const selected = questions.find((q) => q.id === selectedId) ?? null;

  // 상태(대기 우선) → 학생 이름 → 최신순 정렬
  const sorted = [...questions].sort((a, b) =>
    (STATUS_RANK[a.status] - STATUS_RANK[b.status]) ||
    a.studentName.localeCompare(b.studentName) ||
    (a.created_at < b.created_at ? 1 : -1),
  );

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

  // 실시간 구독 — 학생의 새 질문이 도착하면 즉시 타임라인 반영 (중복 가드)
  useRealtimeMessages(selectedId, (m) =>
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m])),
  );

  // 답장 전송 → tutor 역할로 적재 + 질문 상태 '답변완료' 자동 갱신
  const reply = async () => {
    if (!selected || !input.trim()) return;
    setSending(true);
    const body = input.trim();

    const { data, error } = await supabase
      .from('tutor_messages')
      .insert({ question_id: selected.id, sender_id: userId, sender_role: 'tutor', body })
      .select('id, question_id, sender_id, sender_role, body, created_at')
      .single();

    if (!error && data) {
      setMessages((prev) => (prev.some((x) => x.id === (data as TutorMessage).id) ? prev : [...prev, data as TutorMessage]));
      setInput('');
      await supabase.from('tutor_questions').update({ status: 'ANSWERED' }).eq('id', selected.id);
      setQuestions((prev) => prev.map((q) => (q.id === selected.id ? { ...q, status: 'ANSWERED' } : q)));
    }
    setSending(false);
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-5">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-indigo-500">
          <Inbox size={13} /> Tutor Q&amp;A Inbox
        </p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight text-slate-900">Q&amp;A 수신함</h1>
        <p className="mt-0.5 text-sm text-slate-400">배정된 학생들의 오답 질문에 1:1로 답변하세요.</p>
      </div>

      {questions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-white p-12 text-center text-slate-400">
          <Inbox size={40} className="text-slate-300" />
          <p className="text-sm font-medium">아직 배정된 질문이 없습니다.</p>
          <p className="text-xs">학생이 오답 보관함에서 질문을 보내면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <div className="grid h-[calc(100vh-13rem)] grid-cols-1 gap-5 lg:grid-cols-[38%_1fr]">
          {/* 좌: 배정 피드 */}
          <div className="space-y-2.5 overflow-y-auto pr-1">
            {sorted.map((q) => {
              const sel = q.id === selectedId;
              const st = QUESTION_STATUS[q.status] ?? QUESTION_STATUS.OPEN;
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
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
                      <User size={11} /> {q.studentName}
                    </span>
                    <ChevronRight size={14} className={`ml-auto flex-none ${sel ? 'text-indigo-500' : 'text-slate-300'}`} />
                  </div>
                  <p className="truncate text-xs font-medium text-slate-400">{q.wrong_context.level_1} › {q.wrong_context.level_2}</p>
                  <p className="line-clamp-2 text-sm font-medium leading-6 text-slate-700">
                    {nl(q.wrong_context.question_text).replace(/[#*`>]/g, '').slice(0, 80)}
                  </p>
                </button>
              );
            })}
          </div>

          {/* 우: 컨텍스트 + 대화 + 답장 */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            {!selected ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-slate-300">
                <Inbox size={44} />
                <p className="text-sm font-medium text-slate-400">왼쪽에서 질문을 선택하세요.</p>
              </div>
            ) : (
              <>
                <div className="max-h-[46%] flex-none overflow-y-auto">
                  <ContextBanner q={selected} />
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                  {loading
                    ? <p className="text-center text-sm text-slate-400">불러오는 중…</p>
                    : <MessageList messages={messages} userId={userId} />}
                </div>

                <div className="flex-none border-t border-slate-100 p-3">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) reply(); }}
                      rows={2}
                      placeholder="학생에게 답변을 작성하세요 (Ctrl/⌘+Enter 전송)"
                      className="flex-1 resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm
                                 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                    <button
                      onClick={reply}
                      disabled={sending || !input.trim()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm
                                 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                    >
                      <Send size={15} /> {sending ? '전송…' : '답변 전송'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
