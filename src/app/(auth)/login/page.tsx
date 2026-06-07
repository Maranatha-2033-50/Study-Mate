'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router   = useRouter();
  const supabase = createClient();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [mode,     setMode]     = useState<'login' | 'register'>('login');
  const [name,     setName]     = useState('');
  const [role,     setRole]     = useState<'student' | 'tutor'>('student');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

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

        router.push(profile?.role === 'tutor' ? '/tutor/dashboard' : '/student/dashboard');
      } else {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name, role } },
        });
        if (error) throw error;
        // 이메일 확인 비활성화 시 세션이 즉시 발급됨
        if (signUpData.session) {
          router.push(role === 'tutor' ? '/tutor/dashboard' : '/student/dashboard');
        } else {
          setMode('login');
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-purple-50">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">AI 학습 플랫폼</h1>
        <p className="text-sm text-gray-400 mb-6">
          {mode === 'login' ? '계속하려면 로그인하세요.' : '새 계정을 만드세요.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <input
                type="text"
                placeholder="이름"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand-400"
              />
              <div className="flex gap-2">
                {(['student', 'tutor'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors
                      ${role === r ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-600 hover:border-brand-300'}`}
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
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand-400"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand-400"
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
