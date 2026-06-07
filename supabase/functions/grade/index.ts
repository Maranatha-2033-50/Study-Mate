import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AttemptInput {
  question_id:  string;
  user_answer:  string;
  elapsed_time: number;   // seconds, measured client-side
}

/**
 * POST /grade
 * Body: { session_id: string; attempts: AttemptInput[] }
 *
 * - Looks up correct answers from DB (never trusts client)
 * - Inserts user_attempts rows
 * - Marks session as COMPLETED
 * - Returns { correct_count, total, accuracy_rate, weak_chapters[] }
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

    const { session_id, attempts }: { session_id: string; attempts: AttemptInput[] } =
      await req.json();

    if (!session_id || !Array.isArray(attempts) || attempts.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify session belongs to caller
    const { data: session } = await supabase
      .from('study_sessions')
      .select('user_id, status')
      .eq('id', session_id)
      .single();

    if (!session || session.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (session.status === 'COMPLETED') {
      return new Response(JSON.stringify({ error: 'Session already completed' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch authoritative answers
    const questionIds = attempts.map((a) => a.question_id);
    const { data: questions } = await supabase
      .from('universal_questions')
      .select('id, answer')
      .in('id', questionIds);

    const answerMap = Object.fromEntries(
      (questions ?? []).map((q) => [q.id, q.answer.trim().toUpperCase()])
    );

    // Build attempt rows
    const rows = attempts.map((a) => ({
      session_id,
      question_id:  a.question_id,
      user_answer:  a.user_answer.trim(),
      is_correct:   a.user_answer.trim().toUpperCase() === (answerMap[a.question_id] ?? '__NONE__'),
      elapsed_time: Math.max(0, Math.min(a.elapsed_time, 3600)), // cap at 1 hour
    }));

    const { error: insertErr } = await supabase.from('user_attempts').insert(rows);
    if (insertErr) throw insertErr;

    // Mark session complete
    await supabase
      .from('study_sessions')
      .update({ status: 'COMPLETED' })
      .eq('id', session_id);

    // Aggregate results
    const correctCount = rows.filter((r) => r.is_correct).length;
    const total        = rows.length;

    // Return weakness data for immediate display
    const { data: weakChapters } = await supabase
      .from('weakness_stats')
      .select('chapter_id, level_1, level_2, accuracy_rate')
      .eq('user_id', user.id)
      .order('accuracy_rate', { ascending: true })
      .limit(5);

    return new Response(
      JSON.stringify({
        correct_count:  correctCount,
        total,
        accuracy_rate:  total === 0 ? 0 : Math.round((correctCount / total) * 100),
        weak_chapters:  weakChapters ?? [],
      }),
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
