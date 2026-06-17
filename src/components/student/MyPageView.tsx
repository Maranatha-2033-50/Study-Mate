'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  User, Mail, Phone, Link2, Sparkles, Check, Crown, BadgeCheck, Save, Tag,
} from 'lucide-react';
import type { CategoryType, SubscriptionStatus } from '@/types';

interface Cat { id: string; type: CategoryType; title: string }

interface Props {
  userId:       string;
  name:         string;
  email:        string;
  phone:        string;
  subscription: SubscriptionStatus;
  interests:    string[];
  providers:    string[];
  categories:   Cat[];
}

const TYPE_LABEL: Record<CategoryType, string> = { CERT: '자격증', LANG: '어학', SCHOOL: '교과' };
const TYPE_BADGE: Record<CategoryType, string> = {
  CERT:   'bg-violet-100 text-violet-600',
  LANG:   'bg-sky-100 text-sky-600',
  SCHOOL: 'bg-amber-100 text-amber-600',
};

/* 연동 가능한 소셜 제공자 메타 */
const SOCIALS: { id: string; label: string; dot: string }[] = [
  { id: 'google', label: 'Google', dot: 'bg-rose-500' },
  { id: 'kakao',  label: '카카오',  dot: 'bg-yellow-400' },
  { id: 'naver',  label: '네이버',  dot: 'bg-green-500' },
  { id: 'email',  label: '이메일',  dot: 'bg-slate-400' },
];

/* ── 카드 셸 ─────────────────────────────────────────────── */
function Card({ icon: Icon, title, desc, children }: {
  icon: React.ElementType; title: string; desc?: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Icon size={18} />
        </span>
        <div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          {desc && <p className="text-xs text-slate-400">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
      <Icon size={16} className="text-slate-400" />
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <span className="ml-auto truncate text-sm font-semibold text-slate-700">{value || '—'}</span>
    </div>
  );
}

export function MyPageView({
  userId, name, email, phone, subscription, interests, providers, categories,
}: Props) {
  const supabase = createClient();

  const [phoneVal, setPhoneVal]   = useState(phone);
  const [picked, setPicked]       = useState<Set<string>>(new Set(interests));
  const [savingPhone, setSP]      = useState(false);
  const [savingInt, setSI]        = useState(false);
  const [toast, setToast]         = useState<string | null>(null);

  const isPremium = subscription === 'PREMIUM';
  const linked = (id: string) => providers.includes(id) || (id === 'email' && !!email);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400); };

  const savePhone = async () => {
    setSP(true);
    const { error } = await supabase.from('profiles').update({ phone: phoneVal.trim() || null }).eq('id', userId);
    setSP(false);
    flash(error ? '저장 실패: ' + error.message : '연락처가 저장되었습니다.');
  };

  const toggleInterest = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const saveInterests = async () => {
    setSI(true);
    const { error } = await supabase
      .from('profiles')
      .update({ interest_categories: [...picked] })
      .eq('id', userId);
    setSI(false);
    flash(error ? '저장 실패: ' + error.message : '관심 종목이 저장되었습니다.');
  };

  // 도메인(type)별 카테고리 그룹핑
  const groups = (['CERT', 'LANG', 'SCHOOL'] as CategoryType[])
    .map((t) => ({ type: t, items: categories.filter((c) => c.type === t) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-xl font-black text-white shadow-md">
          {(name || 'U').charAt(0).toUpperCase()}
        </span>
        <div>
          <h1 className="text-2xl font-extrabold leading-tight text-slate-900">{name || '수험생'}님</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-400">
            {isPremium
              ? <><Crown size={14} className="text-amber-500" /> 프리미엄 멤버</>
              : <><Sparkles size={14} className="text-indigo-400" /> 무료 체험 중</>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* 1. 계정 기본 정보 */}
        <Card icon={User} title="계정 기본 정보" desc="가입 시 등록된 정보">
          <div className="space-y-2.5">
            <Row icon={User}  label="이름"   value={name} />
            <Row icon={Mail}  label="이메일" value={email} />
          </div>
        </Card>

        {/* 2. 소셜 연동 계정 상태 */}
        <Card icon={Link2} title="소셜 연동 계정" desc="연결된 로그인 수단">
          <div className="grid grid-cols-2 gap-2.5">
            {SOCIALS.map((s) => {
              const on = linked(s.id);
              return (
                <div key={s.id}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm
                    ${on ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-slate-50'}`}>
                  <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                  <span className="font-medium text-slate-700">{s.label}</span>
                  {on
                    ? <BadgeCheck size={15} className="ml-auto text-emerald-500" />
                    : <span className="ml-auto text-[11px] text-slate-400">미연동</span>}
                </div>
              );
            })}
          </div>
        </Card>

        {/* 3. 연락처 추가/수정 */}
        <Card icon={Phone} title="연락처" desc="비상 연락 및 알림 수신용">
          <div className="flex gap-2">
            <input
              type="tel"
              value={phoneVal}
              onChange={(e) => setPhoneVal(e.target.value)}
              placeholder="010-0000-0000"
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm
                         focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <button
              onClick={savePhone}
              disabled={savingPhone}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm
                         font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
            >
              <Save size={15} /> {savingPhone ? '저장 중…' : '저장'}
            </button>
          </div>
        </Card>

        {/* 5. 구독 등급 */}
        <Card icon={Crown} title="결제 구독 등급" desc="현재 멤버십 상태">
          <div className={`rounded-2xl border p-5 ${isPremium ? 'border-amber-200 bg-amber-50/60' : 'border-indigo-100 bg-indigo-50/50'}`}>
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold
                ${isPremium ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                {isPremium ? <><Crown size={13} /> PREMIUM</> : <><Sparkles size={13} /> FREE TRIAL</>}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              {isPremium
                ? '프리미엄 혜택(1:1 튜터 Q&A, 무제한 AI 플랜)이 활성화되어 있습니다.'
                : '프리미엄으로 업그레이드하면 1:1 튜터 질문과 무제한 AI 플랜을 이용할 수 있어요.'}
            </p>
            {!isPremium && (
              <button
                disabled
                title="결제 퍼널 준비 중"
                className="mt-4 inline-flex cursor-not-allowed items-center gap-1.5 rounded-xl bg-slate-900/90 px-4 py-2.5
                           text-sm font-semibold text-white opacity-60"
              >
                <Crown size={15} /> 프리미엄 업그레이드 (준비 중)
              </button>
            )}
          </div>
        </Card>

        {/* 4. 관심 시험 종목 — 전체 폭 */}
        <div className="lg:col-span-2">
          <Card icon={Tag} title="관심 시험 종목" desc="관심 종목을 선택해 두면 빠르게 진입할 수 있어요">
            <div className="space-y-4">
              {groups.map((g) => (
                <div key={g.type}>
                  <p className={`mb-2 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TYPE_BADGE[g.type]}`}>
                    {TYPE_LABEL[g.type]}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {g.items.map((c) => {
                      const on = picked.has(c.id);
                      return (
                        <button
                          key={c.id}
                          onClick={() => toggleInterest(c.id)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all
                            ${on
                              ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600'}`}
                        >
                          {on && <Check size={14} />}
                          {c.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button
                onClick={saveInterests}
                disabled={savingInt}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm
                           font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
              >
                <Save size={15} /> {savingInt ? '저장 중…' : '관심 종목 저장'}
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* 토스트 */}
      {toast && (
        <div className="toast-in fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl
                        bg-slate-900 px-5 py-3.5 text-sm font-bold text-white shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}
