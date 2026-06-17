import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StudentShell } from '@/components/layout/StudentChrome';
import { MyPageView } from '@/components/student/MyPageView';
import type { CategoryType, SubscriptionStatus } from '@/types';

export const metadata = { title: '마이페이지 | Study Mate' };

export default async function MyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, phone, subscription_status, interest_categories')
    .eq('id', user.id)
    .single();

  const { data: cats } = await supabase
    .from('learning_categories')
    .select('id, type, title')
    .order('title');

  // 연동된 소셜 제공자 (Supabase app_metadata)
  const providersRaw = user.app_metadata?.providers as string[] | undefined;
  const providers = providersRaw ?? (user.app_metadata?.provider ? [user.app_metadata.provider as string] : []);

  return (
    <StudentShell>
      <MyPageView
        userId={user.id}
        name={profile?.name ?? ''}
        email={user.email ?? ''}
        phone={profile?.phone ?? ''}
        subscription={(profile?.subscription_status as SubscriptionStatus) ?? 'FREE_TRIAL'}
        interests={profile?.interest_categories ?? []}
        providers={providers}
        categories={(cats ?? []) as { id: string; type: CategoryType; title: string }[]}
      />
    </StudentShell>
  );
}
