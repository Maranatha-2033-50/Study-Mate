import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function signOutAndRedirect(redirectUrl: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(redirectUrl);
}

// 브라우저 직접 이동(에듀포커스에서 GET으로 호출)
export async function GET(request: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const next = new URL(request.url).searchParams.get('next');
  const redirectUrl = (next && next.startsWith('https://')) ? next : `${siteUrl}/login`;
  return signOutAndRedirect(redirectUrl);
}

// 내부 POST 경로도 유지
export async function POST() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return signOutAndRedirect(`${siteUrl}/login`);
}
