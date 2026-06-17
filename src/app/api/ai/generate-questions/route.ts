import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdmin } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { callSolar, callOpenAI } from '@/lib/ai/clients';

/* 온디맨드 AI 문제 생성 엔진 — 무문항 단원에 실시간 출제 + Supabase 영속화(하이브리드 캐시).
   국내(KR)→Upstage Solar, 글로벌(CA/UK)→OpenAI. 서비스 롤로 RLS 우회 insert. */

interface Body { country: string; grade: string; stream: string; course: string; unit: string }
interface GenQ { question_text: string; options: { A: string; B: string; C: string; D: string }; answer: string; explanation: string; difficulty?: string }

function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function buildPrompt(b: Body) {
  const isKR = b.country === 'KR';
  const lang = isKR ? '한국어' : '영어(English)';
  const system = `You are an expert exam item-writer for the ${b.country} secondary-school curriculum.
Write exactly 5 high-quality multiple-choice questions (4 options A–D) that precisely match the
official difficulty/scope of the given course and unit. Question text in ${lang}. Explanations ALWAYS in Korean.
Return ONLY a JSON object: {"questions":[{"question_text":"...","options":{"A":"","B":"","C":"","D":""},"answer":"A","explanation":"한국어 상세 해설","difficulty":"중"}]}`;
  const user = `국가: ${b.country}\n학년/과정: ${b.grade}\n시험 목적: ${b.stream}\n과목: ${b.course}\n단원: ${b.unit}\n\n위 교육과정에 100% 부합하는 객관식 5문항을 JSON으로 생성하세요.`;
  return { system, user, isKR };
}

function mock(b: Body): GenQ[] {
  return Array.from({ length: 5 }, (_, i) => ({
    question_text: `[${b.course} · ${b.unit}] 표본 문항 ${i + 1} — 핵심 개념을 묻는 객관식 문제입니다.`,
    options: { A: '보기 A', B: '보기 B', C: '보기 C', D: '보기 D' },
    answer: 'A',
    explanation: `이 문항은 ${b.unit} 단원의 핵심 개념을 점검합니다. (AI 키 미설정 시 표본 — 키 설정 후 재생성 권장)`,
    difficulty: '중',
  }));
}

function parse(raw: string | null): GenQ[] | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    const arr: unknown[] = Array.isArray(data) ? data : data.questions ?? [];
    const valid = arr.filter((q): q is GenQ => {
      const o = q as GenQ;
      return !!o?.question_text && !!o?.options?.A && !!o?.answer;
    });
    return valid.length > 0 ? valid.slice(0, 5) : null;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const b = (await req.json()) as Body;
  if (!b?.country || !b?.course || !b?.unit) {
    return NextResponse.json({ error: 'Missing curriculum scope' }, { status: 400 });
  }

  const db = admin();

  // 1. SCHOOL 호스트 카테고리 확보
  let { data: cat } = await db.from('learning_categories').select('id').eq('type', 'SCHOOL').order('created_at').limit(1).maybeSingle();
  if (!cat) {
    const ins = await db.from('learning_categories').insert({ type: 'SCHOOL', title: '글로벌 교과' }).select('id').single();
    cat = ins.data;
  }
  if (!cat) return NextResponse.json({ error: 'category resolve failed' }, { status: 500 });
  const categoryId = cat.id as string;

  // 2. 단원 시그니처로 기존 챕터 조회 (하이브리드 캐시)
  const { data: existing } = await db.from('learning_chapters')
    .select('id')
    .eq('category_id', categoryId).eq('country', b.country).eq('grade_level', b.grade)
    .eq('stream', b.stream).eq('course', b.course).eq('level_2', b.unit)
    .maybeSingle();

  let chapterId = existing?.id as string | undefined;

  if (chapterId) {
    const { count } = await db.from('universal_questions').select('id', { count: 'exact', head: true }).eq('chapter_id', chapterId);
    if ((count ?? 0) > 0) {
      return NextResponse.json({ category_id: categoryId, chapter_id: chapterId, cached: true, count });
    }
  } else {
    const ins = await db.from('learning_chapters').insert({
      category_id: categoryId, level_1: b.course, level_2: b.unit,
      country: b.country, grade_level: b.grade, stream: b.stream, course: b.course,
    }).select('id').single();
    if (!ins.data) return NextResponse.json({ error: 'chapter create failed' }, { status: 500 });
    chapterId = ins.data.id as string;
  }

  // 3. AI 생성 (KR→Solar / 그 외→OpenAI), 실패 시 표본 폴백
  const { system, user: userPrompt, isKR } = buildPrompt(b);
  let raw: string | null = null;
  try {
    raw = await (isKR ? callSolar : callOpenAI)({ system, user: userPrompt, json: true, maxTokens: 3000 });
  } catch { raw = null; }

  const questions = parse(raw) ?? mock(b);
  const usedMock = !parse(raw);

  // 4. 영속화 (서비스 롤)
  const rows = questions.map((q) => ({
    chapter_id:    chapterId!,
    question_type: 'MULTIPLE_4',
    question_text: q.question_text,
    options:       q.options,
    answer:        q.answer,
    difficulty:    q.difficulty || '중',
    explanation:   q.explanation ?? null,
  }));
  const { error: insErr } = await db.from('universal_questions').insert(rows);
  if (insErr) return NextResponse.json({ error: `persist failed: ${insErr.message}` }, { status: 500 });

  return NextResponse.json({ category_id: categoryId, chapter_id: chapterId, cached: false, count: rows.length, mock: usedMock });
}
