import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assessPronunciation, sandboxMetrics, gradeSpeaking, mockSpeakingFeedback } from '@/lib/ai/speaking';
import { checkAndConsumeToken } from '@/lib/token-guard';
import type { PronunciationMetrics, SpeakingFeedback } from '@/types';

/* 스피킹 AI 루브릭 채점 라우트.
   SpeakingRecorder 가 FormData(audio: Blob, duration: 초, [question_text])로 음원을 전송하면,
   ① Azure/Speechace 발음평가 엔진으로 기술 지표를 추출하고(실패 시 음성 길이 기반 샌드박스),
   ② gpt-4o-mini 로 IELTS 밴드 + 한국어 리포트 카드를 생성해(실패 시 mock) 반환한다. */

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'multipart/form-data required' }, { status: 400 });
  }

  const file = form.get('audio');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'audio file missing' }, { status: 400 });
  }

  // [비용 방어 밸브] 스피킹 발음평가+루브릭 채점(LLM) 직전 토큰 검증·차감 (fail-open 스캐폴딩)
  const guard = await checkAndConsumeToken(supabase, user.id, 1500);
  if (!guard.ok) {
    return NextResponse.json({ error: 'UPGRADE_REQUIRED', reason: guard.reason }, { status: 402 });
  }

  const duration     = Number(form.get('duration')) || 0;
  const questionText = typeof form.get('question_text') === 'string' ? (form.get('question_text') as string) : '';

  const audio: Buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || 'audio/webm';

  // ① 발음 지표 추출 (Azure/Speechace) → 키 미설정/실패 시 샌드박스 추정
  let metrics: PronunciationMetrics;
  let engine: 'speech-api' | 'sandbox' = 'speech-api';
  try {
    metrics = await assessPronunciation(audio, mime, questionText);
  } catch (e) {
    console.warn('[ai/speaking] 발음평가 엔진 폴백 → sandbox:', e instanceof Error ? e.message : e);
    metrics = sandboxMetrics(duration);
    engine = 'sandbox';
  }

  // ② 지표 → IELTS 밴드 + 한국어 리포트 (gpt-4o-mini) → 실패 시 mock
  let feedback: SpeakingFeedback;
  let usedMock = false;
  try {
    feedback = await gradeSpeaking(metrics, duration, questionText);
  } catch (e) {
    console.warn('[ai/speaking] gpt-4o-mini 폴백 → mock:', e instanceof Error ? e.message : e);
    feedback = mockSpeakingFeedback(metrics);
    usedMock = true;
  }

  return NextResponse.json({ feedback, engine, mock: usedMock });
}
