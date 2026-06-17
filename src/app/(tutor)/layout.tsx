import { redirect } from 'next/navigation';
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
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <span className="font-bold text-brand-700 text-lg">
          AI 학습 플랫폼 <span className="text-xs font-normal text-gray-400 ml-1">강사 모드</span>
        </span>
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
