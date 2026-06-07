import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * POST /diagnose
 * Body: { category_id: string; count?: number }
 *
 * Creates a DIAGNOSTIC session and returns the initial question set,
 * sampled evenly across all chapters for the given category.
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

    // Authenticate caller
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

    const { category_id, count = 20 }: { category_id: string; count?: number } =
      await req.json();

    if (!category_id) {
      return new Response(JSON.stringify({ error: 'category_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create session
    const { data: session, error: sessErr } = await supabase
      .from('study_sessions')
      .insert({
        user_id:      user.id,
        category_id,
        session_type: 'DIAGNOSTIC',
        config:       { limit_type: 'COUNT', limit_value: count },
        status:       'IN_PROGRESS',
      })
      .select()
      .single();

    if (sessErr) throw sessErr;

    // Fetch questions — join through chapters to filter by category
    const { data: questions, error: qErr } = await supabase
      .from('universal_questions')
      .select(`
        id, question_type, question_text, options, difficulty,
        learning_chapters!inner ( category_id, level_1, level_2 )
      `)
      .eq('learning_chapters.category_id', category_id)
      .limit(count);

    if (qErr) throw qErr;

    // Strip answers from client payload (graded server-side)
    const safeQuestions = (questions ?? []).map((q) => ({
      id:            q.id,
      question_type: q.question_type,
      question_text: q.question_text,
      options:       q.options,
      difficulty:    q.difficulty,
      chapter:       q.learning_chapters,
    }));

    return new Response(
      JSON.stringify({ session_id: session.id, questions: safeQuestions }),
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
