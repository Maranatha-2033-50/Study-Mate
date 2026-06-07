import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateStudyPlan } from '@/lib/ai/planner';
import type { PlannerInput } from '@/types';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body: PlannerInput = await req.json();

  if (!body.exam_date || !body.category_title || !body.weak_chapters?.length) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  try {
    const plan = await generateStudyPlan(body);
    return NextResponse.json({ plan });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
