'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Provider } from '@supabase/supabase-js';

// ── 소셜 로그인 버튼 디자인 정의 ──────────────────────────────
const SOCIAL_PROVIDERS = [
  {
    id: 'google' as Provider,
    label: 'Google로 계속하기',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
    className: 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50',
  },
  {
    id: 'kakao' as Provider,
    label: '카카오로 계속하기',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#000000" aria-hidden="true">
        <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.7 1.716 5.07 4.32 6.48L5.4 21l4.44-2.64c.72.12 1.44.18 2.16.18 5.523 0 10-3.477 10-7.76S17.523 3 12 3z"/>
      </svg>
    ),
    className: 'bg-[#FEE500] border border-[#FEE500] text-black hover:brightness-95',
  },
  {
    id: 'custom:naver' as unknown as Provider,
    label: '네이버로 계속하기',
    icon: (
      <span className="text-white font-extrabold text-sm leading-none" aria-hidden="true">N</span>
    ),
    className: 'bg-[#03C75A] border border-[#03C75A] text-white hover:brightness-95',
  },
] as const;

// ── 내부 컴포넌트 (useSearchParams는 Suspense 안에서만 사용 가능) ──
function LoginContent() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const supabase    = createClient();

  const nextUrl    = searchParams.get('next') ?? '';
  const initMode   = searchParams.get('register') === '1' ? 'register' : 'login';

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [mode,     setMode]     = useState<'login' | 'register'>(initMode);
  const [name,     setName]     = useState('');
  const [role,     setRole]     = useState<'student' | 'tutor'>('student');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [verifyMsg, setVerifyMsg] = useState(false);

  // HashRouter URL(# 포함)에 ?login_status=success를 # 앞에 삽입
  function withLoginSuccess(url: string): string {
    const hashIdx = url.indexOf('#');
    const base = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
    const hash = hashIdx >= 0 ? url.slice(hashIdx) : '';
    const sep  = base.includes('?') ? '&' : '?';
    return `${base}${sep}login_status=success${hash}`;
  }

  function resolveRedirect(userRole: string) {
    if (nextUrl) {
      // 외부 URL (에듀포커스 등) — login_status=success 파라미터 추가
      if (nextUrl.startsWith('http')) {
        window.location.href = withLoginSuccess(nextUrl);
        return;
      }
      router.push(nextUrl);
      return;
    }
    router.push(userRole === 'tutor' ? '/tutor/dashboard' : '/student/dashboard');
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        resolveRedirect(profile?.role ?? 'student');
      } else {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name, role } },
        });
        if (error) throw error;
        if (signUpData.session) {
          resolveRedirect(role);
        } else {
          // 이메일 인증 확인 필요 — 안내 메시지 표시 후 로그인 모드로 전환
          setVerifyMsg(true);
          setMode('login');
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: Provider) => {
    setError('');
    const callbackBase = `${window.location.origin}/auth/callback`;
    const redirectTo   = nextUrl
      ? `${callbackBase}?next=${encodeURIComponent(nextUrl)}`
      : callbackBase;

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) setError(error.message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-purple-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">AI 학습 플랫폼</h1>
        <p className="text-sm text-gray-400 mb-6">
          {mode === 'login' ? '계속하려면 로그인하세요.' : '새 계정을 만드세요.'}
        </p>

        {/* ── 이메일 인증 안내 배너 ── */}
        {verifyMsg && (
          <div className="mb-5 flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
            <span className="mt-0.5 text-blue-500 text-lg">✉️</span>
            <div>
              <p className="text-sm font-semibold text-blue-800">인증 메일을 발송했습니다!</p>
              <p className="text-xs text-blue-600 mt-0.5">
                입력하신 이메일로 인증 링크가 발송되었습니다.<br />
                메일함을 확인하고 링크를 클릭한 뒤 로그인해주세요.
              </p>
            </div>
          </div>
        )}

        {/* ── 소셜 로그인 ── */}
        <div className="flex flex-col gap-2.5 mb-6">
          {SOCIAL_PROVIDERS.map(({ id, label, icon, className }) => (
            <button
              key={String(id)}
              type="button"
              onClick={() => handleSocialLogin(id)}
              className={`flex items-center justify-center gap-2.5 w-full py-2.5 px-4
                          rounded-xl text-sm font-medium transition-all ${className}`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* ── 구분선 ── */}
        <div className="flex items-center gap-3 mb-6">
          <span className="flex-1 h-px bg-gray-100" />
          <span className="text-xs text-gray-400">또는 이메일로</span>
          <span className="flex-1 h-px bg-gray-100" />
        </div>

        {/* ── 이메일/비밀번호 폼 ── */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <input
                type="text"
                placeholder="이름"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm
                           focus:outline-none focus:border-brand-400"
              />
              <div className="flex gap-2">
                {(['student', 'tutor'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors
                      ${role === r
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'border-gray-200 text-gray-600 hover:border-brand-300'}`}
                  >
                    {r === 'student' ? '학생' : '강사'}
                  </button>
                ))}
              </div>
            </>
          )}

          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm
                       focus:outline-none focus:border-brand-400"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm
                       focus:outline-none focus:border-brand-400"
          />

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-600 text-white rounded-xl text-sm font-medium
                       hover:bg-brand-700 disabled:opacity-60 transition-colors"
          >
            {loading ? '처리 중…' : mode === 'login' ? '로그인' : '회원가입'}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="mt-4 w-full text-xs text-gray-400 hover:text-gray-600 text-center"
        >
          {mode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-purple-50">
        <div className="text-sm text-gray-400">로딩 중…</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
