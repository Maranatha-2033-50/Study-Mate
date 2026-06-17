import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/* AI 인프라 정밀 진단 — 키 존재/프리픽스(4자)/길이만 반환(값 노출 금지).
   비공개: 강사(관리자) 계정만 접근 가능. */
function inspect(v: string | undefined) {
  if (!v) return { present: false, prefix: null as string | null, length: 0 };
  return { present: true, prefix: `${v.slice(0, 4)}…`, length: v.length };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'tutor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return NextResponse.json({
    runtime: 'nodejs',
    keys: {
      OPENAI_API_KEY:           inspect(process.env.OPENAI_API_KEY),
      SOLAR_API_KEY:            inspect(process.env.SOLAR_API_KEY),
      AI_API_KEY_fallback:      inspect(process.env.AI_API_KEY),
      SUPABASE_SERVICE_ROLE_KEY: inspect(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
    models: {
      openai: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      solar:  process.env.SOLAR_MODEL  ?? 'solar-pro',
    },
  });
}
