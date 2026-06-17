'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { MessageCircleQuestion, ChevronRight, NotebookPen, Send, ArrowLeft } from 'lucide-react';
import { ContextBanner, MessageList, useRealtimeMessages, QUESTION_STATUS, nl } from '@/components/student/qna-shared';
import type { TutorQuestion, TutorMessage } from '@/types';

/* ── 1:1 선생님 문의방 (학생 뷰) ── */
export function QnaRoom({ questions, userId }: { questions: TutorQuestion[]; userId: string }) {
  const [supabase] = useState(() => createClient());

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

  // 실시간 구독 — 선생님 답장이 도착하면 즉시 타임라인에 반영 (중복 가드)
  useRealtimeMessages(selectedId, (m) =>
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m])),
  );

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
      setMessages((prev) => (prev.some((x) => x.id === (data as TutorMessage).id) ? prev : [...prev, data as TutorMessage]));
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
