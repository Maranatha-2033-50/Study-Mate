import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { computeStudyBudget, WEEKDAYS } from '@/lib/planner-budget';
import { generateInteractivePlan, mockPlan, type PlanGenInput } from '@/lib/ai/study-plan';
import type { AvailabilityMatrix, InteractivePlan, SubscriptionStatus, WeaknessStat } from '@/types';

interface Body {
  category_id:         string;
  category_title:      string;
  exam_date:           string;              // YYYY-MM-DD
  availability_matrix: AvailabilityMatrix;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body: Body = await req.json();
  if (!body.category_id || !body.exam_date || !body.availability_matrix) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // ── [Paywall Hook] ──────────────────────────────────────────────────────────
  //  AI 플래너는 전 등급(BASIC 포함) 허용 정책이므로 여기서는 게이트하지 않는다(no-op).
  //  등급별 플랜 한도를 도입할 경우: 프로필에서 subscription_status 를 읽어 잠긴 등급이면
  //  402(UPGRADE_REQUIRED)를 반환하면 클라이언트가 페이월 모달만 띄우도록 바로 연결된다.
  const subscriptionStatus = 'BASIC' as SubscriptionStatus;
  const isPlanLocked = false as boolean;
  if (subscriptionStatus !== 'PREMIUM' && isPlanLocked) {
    // return NextResponse.json({ error: 'UPGRADE_REQUIRED' }, { status: 402 });
  }

  // 1. Study Budget 계산 (오늘~시험일 요일별 가용시간 합산)
  const { totalHours, dDay } = computeStudyBudget(body.exam_date, body.availability_matrix);
  if (dDay <= 0) {
    return NextResponse.json({ error: '시험일은 오늘 이후여야 합니다.' }, { status: 400 });
  }

  // 2. 취약 단원 로드
  const { data: statsRaw } = await supabase
    .from('weakness_stats')
    .select('*')
    .eq('user_id', user.id)
    .eq('category_id', body.category_id)
    .order('accuracy_rate', { ascending: true });
  const weakStats = (statsRaw as WeaknessStat[]) ?? [];

  const weeklyBreakdown = WEEKDAYS
    .map((d) => `${d.label} ${body.availability_matrix[d.key] ?? 0}h`)
    .join(', ');

  const genInput: PlanGenInput = {
    categoryTitle: body.category_title,
    examDate:      body.exam_date,
    dDay,
    budgetHours:   totalHours,
    weeklyBreakdown,
    weakStats,
  };

  // 3. AI 생성 (실패/키부재 시 mock 폴백)
  let plan: InteractivePlan;
  try {
    plan = await generateInteractivePlan(genInput);
    if (!plan.milestones?.length) plan = mockPlan(genInput);
  } catch {
    plan = mockPlan(genInput);
  }

  // 4. 업서트 — (user, category) 당 1개, 재생성 시 completed_items 초기화
  const { data: saved, error } = await supabase
    .from('ai_study_plans')
    .upsert(
      {
        user_id:             user.id,
        category_id:         body.category_id,
        exam_date:           body.exam_date,
        availability_matrix: body.availability_matrix,
        plan_content:        JSON.stringify(plan),
        completed_items:     {},
        updated_at:          new Date().toISOString(),
      },
      { onConflict: 'user_id,category_id' },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ plan: saved, budget: { totalHours, dDay } });
}
