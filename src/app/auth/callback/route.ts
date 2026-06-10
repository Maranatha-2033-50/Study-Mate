import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // 외부 도메인(에듀포커스)으로 복귀
      if (next && next.startsWith('https://')) {
        return NextResponse.redirect(next);
      }
      // 내부 next 또는 기본 대시보드
      const dest = next && next.startsWith('/') ? next : '/student/dashboard';
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
