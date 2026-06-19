'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Inbox, ChevronRight, Send, User, Users, UserPlus } from 'lucide-react';
import { ContextBanner, MessageList, useRealtimeMessages, QUESTION_STATUS, nl } from '@/components/student/qna-shared';
import type { TutorQuestion, TutorMessage } from '@/types';

export interface TutorInboxQuestion extends TutorQuestion {
  studentName: string;
}

const STATUS_RANK: Record<string, number> = { OPEN: 0, ANSWERED: 1, CLOSED: 2 };
type Tab = 'MINE' | 'POOL';

/* ── 교사 전용 Q&A 수신함 — [내 전용 질문] / [미배정 질문 풀(Claim)] ── */
export function TutorQnaRoom({
  assigned: initialAssigned, pool: initialPool, userId,
}: {
  assigned: TutorInboxQuestion[];
  pool: TutorInboxQuestion[];
  userId: string;
}) {
  const [supabase] = useState(() => createClient());

  const [tab, setTab]             = useState<Tab>('MINE');
  const [assigned, setAssigned]   = useState<TutorInboxQuestion[]>(initialAssigned);
  const [pool, setPool]           = useState<TutorInboxQuestion[]>(initialPool);
  const [selectedId, setSelectedId] = useState<string | null>(initialAssigned[0]?.id ?? null);
  const [messages, setMessages]   = useState<TutorMessage[]>([]);
  const [loading, setLoading]     = useState(false);
  const [input, setInput]         = useState('');
  const [sending, setSending]     = useState(false);
  const [claiming, setClaiming]   = useState<string | null>(null);
  const [toast, setToast]         = useState<string | null>(null);

  const list = tab === 'MINE' ? assigned : pool;
  const selected = list.find((q) => q.id === selectedId) ?? null;

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  // 상태(대기 우선) → 학생 이름 → 최신순 정렬
  const sorted = [...list].sort((a, b) =>
    (STATUS_RANK[a.status] - STATUS_RANK[b.status]) ||
    a.studentName.localeCompare(b.studentName) ||
    (a.created_at < b.created_at ? 1 : -1),
  );

  // 탭 전환 시 해당 탭의 첫 항목 선택
  const switchTab = (t: Tab) => {
    setTab(t);
    const first = (t === 'MINE' ? assigned : pool)[0]?.id ?? null;
    setSelectedId(first);
  };

  // 메시지 로드 — 내 전용 질문(스레드 접근 가능)일 때만. 미배정 풀은 클레임 전까지 컨텍스트만 노출.
  useEffect(() => {
    if (tab !== 'MINE' || !selectedId) { setMessages([]); return; }
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
  }, [tab, selectedId, supabase]);

  // 실시간 구독 — 내 전용 질문 스레드에 새 메시지 도착 시 반영 (중복 가드)
  useRealtimeMessages(tab === 'MINE' ? selectedId : null, (m) =>
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
      setAssigned((prev) => prev.map((q) => (q.id === selected.id ? { ...q, status: 'ANSWERED' } : q)));
    }
    setSending(false);
  };

  // 질문 가져오기(Claim) — 원자적 갱신: tutor_id IS NULL 조건이 남아있을 때만 성공.
  // 다른 교사가 먼저 채갔으면 0행 → 풀에서 제거하고 안내.
  const claim = async (q: TutorInboxQuestion) => {
    setClaiming(q.id);
    const { data, error } = await supabase
      .from('tutor_questions')
      .update({ tutor_id: userId })
      .eq('id', q.id)
      .is('tutor_id', null)
      .select('id')
      .maybeSingle();
    setClaiming(null);

    if (error) { flash('가져오기 실패: ' + error.message); return; }
    setPool((prev) => prev.filter((x) => x.id !== q.id));
    if (!data) { flash('다른 선생님이 먼저 가져간 질문이에요.'); return; }

    // 내 전용 큐로 워프
    const claimed: TutorInboxQuestion = { ...q, tutor_id: userId };
    setAssigned((prev) => (prev.some((x) => x.id === claimed.id) ? prev : [claimed, ...prev]));
    setTab('MINE');
    setSelectedId(claimed.id);
    flash('질문을 내 전용 큐로 가져왔습니다.');
  };

  const TabButton = ({ id, icon: Icon, label, count }: { id: Tab; icon: React.ElementType; label: string; count: number }) => {
    const active = tab === id;
    return (
      <button
        onClick={() => switchTab(id)}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all
          ${active ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
      >
        <Icon size={15} /> {label}
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'}`}>
          {count}
        </span>
      </button>
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-5">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-indigo-500">
          <Inbox size={13} /> Tutor Q&amp;A Inbox
        </p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight text-slate-900">Q&amp;A 수신함</h1>
        <p className="mt-0.5 text-sm text-slate-400">배정된 학생 질문에 답하고, 담당자가 없는 질문은 직접 가져가세요.</p>
      </div>

      <div className="grid h-[calc(100vh-13rem)] grid-cols-1 gap-5 lg:grid-cols-[38%_1fr]">
        {/* 좌: 탭 + 피드 */}
        <div className="flex flex-col gap-3 overflow-hidden">
          <div className="flex flex-none gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-1.5">
            <TabButton id="MINE" icon={User}  label="내 전용 질문"     count={assigned.length} />
            <TabButton id="POOL" icon={Users} label="미배정 질문 풀" count={pool.length} />
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
            {sorted.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-white p-10 text-center text-slate-400">
                {tab === 'MINE' ? <Inbox size={36} className="text-slate-300" /> : <Users size={36} className="text-slate-300" />}
                <p className="text-sm font-medium">
                  {tab === 'MINE' ? '아직 배정된 질문이 없습니다.' : '대기 중인 미배정 질문이 없습니다.'}
                </p>
                <p className="text-xs">
                  {tab === 'MINE'
                    ? '미배정 풀에서 질문을 가져오면 여기로 모입니다.'
                    : '담당자가 지정되지 않은 학생 질문이 들어오면 여기에 표시됩니다.'}
                </p>
              </div>
            ) : (
              sorted.map((q) => {
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
              })
            )}
          </div>
        </div>

        {/* 우: 컨텍스트 + (내 전용)대화·답장 / (미배정)클레임 */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          {!selected ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-slate-300">
              <Inbox size={44} />
              <p className="text-sm font-medium text-slate-400">왼쪽에서 질문을 선택하세요.</p>
            </div>
          ) : tab === 'POOL' ? (
            <>
              <div className="flex-1 overflow-y-auto">
                <ContextBanner q={selected} />
              </div>
              <div className="flex-none border-t border-slate-100 p-4">
                <p className="mb-2.5 text-xs text-slate-400">
                  이 질문은 아직 담당 선생님이 없습니다. 가져오면 내 전용 큐로 이동하고 답변할 수 있어요.
                </p>
                <button
                  onClick={() => claim(selected)}
                  disabled={claiming === selected.id}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3
                             text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                >
                  <UserPlus size={16} /> {claiming === selected.id ? '가져오는 중…' : '질문 가져오기 (Claim)'}
                </button>
              </div>
            </>
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

      {toast && (
        <div className="toast-in fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl
                        bg-slate-900 px-5 py-3.5 text-sm font-bold text-white shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}
