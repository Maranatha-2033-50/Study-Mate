import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// HashRouter URL(# 포함)에 ?login_status=success를 # 앞에 삽입
function withLoginSuccess(url: string): string {
  const hashIdx = url.indexOf('#');
  const base = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
  const hash = hashIdx >= 0 ? url.slice(hashIdx) : '';
  const sep  = base.includes('?') ? '&' : '?';
  return `${base}${sep}login_status=success${hash}`;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // 외부 도메인(에듀포커스)으로 복귀 — login_status=success 추가
      if (next && next.startsWith('https://')) {
        return NextResponse.redirect(withLoginSuccess(next));
      }
      // 내부 next 또는 기본 대시보드
      const dest = next && next.startsWith('/') ? next : '/student/dashboard';
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
