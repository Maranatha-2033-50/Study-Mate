import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { LayoutDashboard, Brain, LogOut, NotebookPen, Award, Languages, GraduationCap } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/student/dashboard',   label: '대시보드',     icon: LayoutDashboard },
  { href: '/student/cert',        label: '자격증',       icon: Award },
  { href: '/student/lang',        label: '어학',         icon: Languages },
  { href: '/student/school',      label: '교과',         icon: GraduationCap },
  { href: '/student/incorrect',   label: '오답노트',     icon: NotebookPen },
  { href: '/student/planner',     label: 'AI 플래너',    icon: Brain },
];

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, name')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'tutor') redirect('/tutor/dashboard');

  const initial = (profile?.name ?? 'U').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── GNB ── */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

          {/* 로고 + 네비게이션 */}
          <div className="flex items-center gap-8">
            <Link href="/student/dashboard" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                <span className="text-white text-xs font-extrabold tracking-tight">AI</span>
              </div>
              <span className="font-bold text-slate-900 text-base hidden sm:block">학습 플랫폼</span>
            </Link>

            <nav className="flex items-center gap-0.5">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium
                             text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  <Icon size={15} />
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          {/* 사용자 정보 */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
              <span className="text-indigo-700 text-sm font-bold">{initial}</span>
            </div>
            <span className="text-sm font-medium text-slate-700 hidden sm:block">{profile?.name}</span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition-colors"
              >
                <LogOut size={13} />
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* ── 페이지 콘텐츠 ── */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
