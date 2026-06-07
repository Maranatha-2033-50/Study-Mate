import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WeakChapter {
  level_1:       string;
  level_2:       string;
  accuracy_rate: number;
}

interface PlanRequest {
  category_title:  string;
  weak_chapters:   WeakChapter[];
  exam_date:       string;    // YYYY-MM-DD
  available_hours: number;
}

function buildUserPrompt(req: PlanRequest, daysLeft: number): string {
  const weakList = req.weak_chapters
    .slice(0, 5)
    .map((w, i) => `${i + 1}. [${w.level_1}] ${w.level_2} — 정답률 ${w.accuracy_rate}%`)
    .join('\n');

  return `
## 학생 데이터
- 시험/과목: ${req.category_title}
- 시험까지 남은 일수: ${daysLeft}일 (목표일: ${req.exam_date})
- 하루 가용 공부 시간: ${req.available_hours}시간

## 취약 단원 Top-${req.weak_chapters.slice(0, 5).length}
${weakList}

위 데이터를 기반으로 향후 7일간의 '약점 격파 루틴 테이블'을 JSON으로 생성하세요.
응답은 반드시 다음 JSON 스키마를 따르세요:
{
  "summary": "전략 요약 (2~3문장)",
  "weekly_goal": "이번 주 핵심 목표",
  "daily_plans": [
    {
      "date": "YYYY-MM-DD",
      "sessions": [
        {
          "time_slot": "예: 오전 09:00",
          "chapter": "단원명",
          "task": "구체적 학습 과제",
          "duration_min": 분(숫자)
        }
      ]
    }
  ],
  "tips": ["추가 학습 팁 3가지"]
}
JSON만 반환하고, 다른 텍스트는 포함하지 마세요.
`.trim();
}

/**
 * POST /plan-generation
 * Body: PlanRequest
 *
 * Calls the configured AI API (Claude or Solar LLM) and returns
 * a structured 7-day study plan based on the student's weak chapters.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader?.replace('Bearer ', '') ?? ''
    );
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: PlanRequest = await req.json();
    const { category_title, weak_chapters, exam_date, available_hours } = body;

    if (!exam_date || !category_title || !weak_chapters?.length) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const examMs  = new Date(exam_date).getTime();
    const nowMs   = Date.now();
    const daysLeft = Math.max(1, Math.ceil((examMs - nowMs) / (1000 * 60 * 60 * 24)));

    const AI_BASE_URL = Deno.env.get('AI_BASE_URL') ?? 'https://api.anthropic.com/v1';
    const AI_MODEL    = Deno.env.get('AI_MODEL')    ?? 'claude-sonnet-4-6';
    const AI_API_KEY  = Deno.env.get('AI_API_KEY')  ?? '';

    const aiRes = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model:      AI_MODEL,
        max_tokens: 2048,
        messages: [
          {
            role:    'system',
            content: '당신은 대입 교과 과외 및 자격증/어학 전문 전략가입니다. 학생의 현재 취약 영역 통계와 목표 시험 정보, 하루 가용 시간을 분석하여 실현 가능하고 정교한 "약점 격파 루틴 테이블"을 일자별/교시별로 상세히 수립하세요.',
          },
          {
            role:    'user',
            content: buildUserPrompt(body, daysLeft),
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`AI API ${aiRes.status}: ${errText}`);
    }

    const aiData = await aiRes.json();
    const rawText: string = aiData.choices[0].message.content.trim();

    // Strip markdown code fence if present
    const jsonText = rawText.startsWith('```')
      ? rawText.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim()
      : rawText;

    const plan = JSON.parse(jsonText);

    return new Response(
      JSON.stringify({ plan }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
