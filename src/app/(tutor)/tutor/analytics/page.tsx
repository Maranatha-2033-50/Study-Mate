import { redirect } from 'next/navigation';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { BarChart3, Flame, Layers } from 'lucide-react';
import type { CategoryType, WrongContext } from '@/types';

export const metadata = { title: '관리자 통계 | Study Mate 강사' };

/* 전역 통계는 RLS 우회가 필요하므로 서버 전용 service-role 클라이언트로 집계.
   (이 파일은 서버 컴포넌트 — 서비스 키는 클라이언트로 전송되지 않음) */
function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

const DOMAIN_META: Record<CategoryType, { label: string; bar: string; chip: string }> = {
  CERT:   { label: '자격증', bar: 'bg-violet-500', chip: 'bg-violet-100 text-violet-700' },
  LANG:   { label: '어학',   bar: 'bg-sky-500',    chip: 'bg-sky-100 text-sky-700' },
  SCHOOL: { label: '교과',   bar: 'bg-amber-500',  chip: 'bg-amber-100 text-amber-700' },
};

const clean = (s: string) => s.replace(/\\n/g, ' ').replace(/[#*`>]/g, '').trim();

export default async function TutorAnalyticsPage() {
  // 관리자 게이팅: 로그인 유저의 is_admin 이 참일 때만 전역 통계판 진입 허용.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) redirect('/');

  const admin = adminClient();

  const [{ data: tqRaw }, { data: catsRaw }] = await Promise.all([
    admin.from('tutor_questions').select('question_id, wrong_context'),
    admin.from('learning_categories').select('title, type'),
  ]);

  const rows = (tqRaw ?? []) as { question_id: string | null; wrong_context: WrongContext }[];
  const typeByTitle = new Map<string, CategoryType>();
  for (const c of (catsRaw ?? []) as { title: string; type: CategoryType }[]) typeByTitle.set(c.title, c.type);

  // ── 킬러 문항 Top 10 (질문 누적 횟수) ──
  const killer = new Map<string, { count: number; text: string; cat: string; chapter: string }>();
  // ── 도메인별 단원 질문 빈도 ──
  const byDomain: Record<CategoryType, Map<string, number>> = {
    CERT: new Map(), LANG: new Map(), SCHOOL: new Map(),
  };

  for (const r of rows) {
    const wc = r.wrong_context ?? ({} as WrongContext);
    const key = r.question_id ?? wc.question_text ?? '(unknown)';
    const prev = killer.get(key);
    if (prev) prev.count += 1;
    else killer.set(key, {
      count: 1,
      text: clean(wc.question_text ?? '(문항 정보 없음)'),
      cat: wc.category_title ?? '—',
      chapter: [wc.level_1, wc.level_2].filter(Boolean).join(' › ') || '—',
    });

    const type = typeByTitle.get(wc.category_title ?? '') ?? 'CERT';
    const chapterKey = [wc.level_1, wc.level_2].filter(Boolean).join(' › ') || '(미분류)';
    byDomain[type].set(chapterKey, (byDomain[type].get(chapterKey) ?? 0) + 1);
  }

  const killerTop = [...killer.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  const totalQ = rows.length;

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-8">
      {/* 헤더 */}
      <div>
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-indigo-500">
          <BarChart3 size={13} /> Master Analytics
        </p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight text-slate-900">어려운 문제 관리자 통계판</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          누적 질문 {totalQ}건 기준 — 학생들이 가장 막힌 킬러 문항과 단원을 데이터 자산으로 축적합니다.
        </p>
      </div>

      {/* 킬러 문항 Top 10 */}
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Flame size={18} className="text-rose-500" />
          <h2 className="text-lg font-bold text-slate-900">가장 많이 질문된 킬러 문항 Top 10</h2>
        </div>
        {killerTop.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">아직 집계된 질문이 없습니다.</p>
        ) : (
          <ol className="space-y-2">
            {killerTop.map((k, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg text-sm font-black
                  ${i < 3 ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-600'}`}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-700">{k.text}</p>
                  <p className="text-xs text-slate-400">{k.cat} · {k.chapter}</p>
                </div>
                <span className="flex-none rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-600">
                  {k.count}회 질문
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* 도메인별 단원 질문 빈도 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Layers size={18} className="text-indigo-500" />
          <h2 className="text-lg font-bold text-slate-900">도메인별 단원 질문 빈도</h2>
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {(['CERT', 'LANG', 'SCHOOL'] as CategoryType[]).map((type) => {
            const meta = DOMAIN_META[type];
            const entries = [...byDomain[type].entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
            const max = entries[0]?.[1] ?? 1;
            return (
              <div key={type} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${meta.chip}`}>{meta.label}</span>
                {entries.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">질문 데이터 없음</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {entries.map(([chapter, count]) => (
                      <div key={chapter}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-medium text-slate-600">{chapter}</span>
                          <span className="flex-none text-xs font-bold text-slate-500">{count}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-2 rounded-full ${meta.bar}`} style={{ width: `${Math.round((count / max) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
