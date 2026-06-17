import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function TutorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, name')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'tutor') redirect('/');

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <span className="font-bold text-indigo-700 text-lg whitespace-nowrap">
            스터디메이트 <span className="text-xs font-normal text-gray-400 ml-1">강사 모드</span>
          </span>
          <nav className="flex items-center gap-1">
            {[
              { href: '/tutor/dashboard', label: '학생 리포트' },
              { href: '/tutor/qna',       label: 'Q&A 수신함' },
              { href: '/tutor/analytics', label: '통계' },
            ].map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
              >
                {m.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{profile?.name}</span>
          <form action="/auth/signout" method="post">
            <button className="text-xs text-gray-400 hover:text-gray-600">로그아웃</button>
          </form>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
