import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/* ── 마스터 통계판(/tutor/analytics) 2중 보안 락 — Phase 13 ───────────────────────
   1차 락(미들웨어): 진입 전 인증 + profiles.is_admin 을 검증해 비관리자는 라우트에 닿기 전 차단.
   2차 락(컴포넌트): 페이지 서버 컴포넌트가 동일하게 is_admin 을 재검증(이미 적용됨).
   matcher 로 /tutor/analytics 에만 적용 → 그 외 라우트에는 일절 관여하지 않는다. */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (toSet: { name: string; value: string; options: CookieOptions }[]) =>
          toSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', req.url));

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) return NextResponse.redirect(new URL('/', req.url));

  return res;
}

export const config = {
  matcher: ['/tutor/analytics', '/tutor/analytics/:path*'],
};
