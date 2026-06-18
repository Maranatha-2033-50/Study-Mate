import { callOpenAI } from '@/lib/ai/clients';
import type { PronunciationMetrics, SpeakingFeedback } from '@/types';

/* ────────────────────────────────────────────────────────────────────────────
   어학 스피킹 발음/유창성 채점 파이프라인
   1) assessPronunciation : Azure Speech(Pronunciation Assessment) / Speechace 엔진으로
      발음 정확도(Accuracy)·유창성(Fluency)·완급(Prosody) 기술 지표를 추출.
   2) gradeSpeaking       : 추출된 지표를 gpt-4o-mini 에 컨텍스트로 주입해 IELTS 스피킹
      밴드 스코어 + 한국어 원어민 피드백 리포트 카드(JSON)로 가공.
   외부 Speech 키 미설정/네트워크 실패 시 라우트가 sandboxMetrics + mockSpeakingFeedback 로
   안전하게 폴백한다. 키는 서버(process.env)에서만 읽으며 클라이언트로 노출되지 않는다.
──────────────────────────────────────────────────────────────────────────── */

export class SpeechKeyMissingError extends Error {
  constructor() {
    super('No pronunciation-assessment key configured (SPEECHACE_API_KEY / AZURE_SPEECH_KEY)');
    this.name = 'SpeechKeyMissingError';
  }
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

// ── 1) 발음 평가 엔진 인터페이스 (Speechace 우선 → Azure) ─────────────────────
export async function assessPronunciation(
  audio: Buffer,
  mime: string,
  referenceText: string,
): Promise<PronunciationMetrics> {
  if (process.env.SPEECHACE_API_KEY) {
    return viaSpeechace(audio, mime, referenceText, process.env.SPEECHACE_API_KEY);
  }
  if (process.env.AZURE_SPEECH_KEY) {
    return viaAzure(audio, mime, referenceText, process.env.AZURE_SPEECH_KEY, process.env.AZURE_SPEECH_REGION ?? 'eastus');
  }
  throw new SpeechKeyMissingError();
}

async function viaSpeechace(audio: Buffer, mime: string, text: string, key: string): Promise<PronunciationMetrics> {
  const form = new FormData();
  form.append('user_audio_file', new Blob([new Uint8Array(audio)], { type: mime }), 'speech.webm');
  if (text) form.append('text', text);
  const res = await fetch(`https://api.speechace.co/api/scoring/speech/v9/json?key=${encodeURIComponent(key)}&dialect=en-us`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(`Speechace ${res.status}`);
  const d = await res.json();
  const score = d?.speechace_score ?? d?.text_score ?? {};
  const accuracy = score.pronunciation ?? score.quality_score;
  const fluency  = d?.fluency?.overall_metrics?.fluency_score ?? score.fluency;
  if (accuracy == null) throw new Error('Speechace: unparseable score payload');
  return {
    accuracy: clamp(accuracy),
    fluency:  clamp(fluency ?? accuracy),
    prosody:  clamp((fluency ?? accuracy) * 0.95),
  };
}

async function viaAzure(audio: Buffer, mime: string, text: string, key: string, region: string): Promise<PronunciationMetrics> {
  const paConfig = Buffer.from(JSON.stringify({
    ReferenceText: text,
    GradingSystem: 'HundredMark',
    Granularity: 'FullText',
    EnableProsodyAssessment: true,
  })).toString('base64');

  const res = await fetch(
    `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US`,
    {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Pronunciation-Assessment': paConfig,
        'Content-Type': mime || 'audio/webm; codecs=opus',
        Accept: 'application/json',
      },
      body: new Uint8Array(audio),
    },
  );
  if (!res.ok) throw new Error(`Azure ${res.status}`);
  const d = await res.json();
  const a = d?.NBest?.[0]?.PronunciationAssessment ?? {};
  if (a.AccuracyScore == null) throw new Error('Azure: unparseable score payload');
  return {
    accuracy: clamp(a.AccuracyScore),
    fluency:  clamp(a.FluencyScore ?? a.AccuracyScore),
    prosody:  clamp(a.ProsodyScore ?? a.FluencyScore ?? a.AccuracyScore),
  };
}

// ── 샌드박스 폴백: 발화 길이 기반의 그럴듯한 지표 추정 ─────────────────────────
export function sandboxMetrics(durationSec: number): PronunciationMetrics {
  const d = Math.max(0, durationSec);
  const base = d < 5 ? 55 : d < 15 ? 68 : d < 40 ? 78 : 82;
  return { accuracy: clamp(base + 4), fluency: clamp(base), prosody: clamp(base - 3) };
}

// ── 지표 → IELTS 밴드 환산 (0–100 평균 → 0–9, .5 단위) ────────────────────────
function bandFromMetrics(m: PronunciationMetrics): number {
  const avg = (m.accuracy + m.fluency + m.prosody) / 3;
  return Math.round((avg / 100) * 9 * 2) / 2;
}

// ── 2) 지표 → gpt-4o-mini → IELTS 밴드 + 한국어 리포트 카드 ───────────────────
const SYSTEM_PROMPT = `You are an official IELTS Speaking examiner and a friendly Korean pronunciation coach.
You receive objective pronunciation metrics (0–100) produced by a speech-assessment engine:
Accuracy, Fluency, Prosody. Convert them into an IELTS Speaking assessment.

Respond with a SINGLE JSON object only (no markdown, no prose) in EXACTLY this schema:
{
  "band_score": number,            // IELTS Speaking band 0–9, .5 increments, consistent with the metrics
  "criteria": {                    // keys MUST be the four IELTS Speaking descriptors below
    "Fluency and Coherence":            { "score": number, "comment": "one-line eval (Korean)" },
    "Lexical Resource":                 { "score": number, "comment": "one-line eval (Korean)" },
    "Grammatical Range and Accuracy":   { "score": number, "comment": "one-line eval (Korean)" },
    "Pronunciation":                    { "score": number, "comment": "one-line eval (Korean)" }
  },
  "strengths":    ["강점 (Korean)", "..."],
  "improvements": ["개선점 (Korean)", "..."],
  "general_feedback": "학생용 총평 (Korean, 3~4문장, 격려 포함)"
}
Each criterion score is a band 0–9. All commentary MUST be in Korean.`;

export async function gradeSpeaking(
  metrics: PronunciationMetrics,
  durationSec: number,
  questionText: string,
): Promise<SpeakingFeedback> {
  const user = `## 발음평가 엔진 지표 (0–100)
- Accuracy (발음 정확도): ${metrics.accuracy}
- Fluency (유창성): ${metrics.fluency}
- Prosody (완급·억양): ${metrics.prosody}

## 발화 길이
${durationSec}초

## 스피킹 문항 (있을 경우)
${questionText || '(자유 발화 — 별도 프롬프트 없음)'}

위 기술 지표를 종합해 IELTS 스피킹 밴드와 한국어 리포트를 JSON으로만 반환하세요.`;

  const raw = await callOpenAI({ system: SYSTEM_PROMPT, user, maxTokens: 1200, json: true });
  const parsed = JSON.parse(raw) as SpeakingFeedback;
  // 기술 지표는 엔진이 권위값 — LLM 출력 대신 실제 측정값으로 고정.
  return { ...parsed, metrics };
}

// ── 고품질 mock — Speech 키 비활성/AI 실패 시 안전 폴백 ───────────────────────
export function mockSpeakingFeedback(m: PronunciationMetrics): SpeakingFeedback {
  const band = bandFromMetrics(m);
  return {
    band_score: band,
    metrics: m,
    criteria: {
      'Fluency and Coherence':          { score: band, comment: '발화가 자연스럽게 이어지나 간헐적 망설임이 관찰됩니다.' },
      'Lexical Resource':               { score: band, comment: '핵심 어휘는 적절하나 표현의 다양성을 넓힐 여지가 있습니다.' },
      'Grammatical Range and Accuracy': { score: band, comment: '기본 문형은 정확하나 복문에서 시제가 흔들립니다.' },
      'Pronunciation':                  { score: band, comment: `정확도 ${m.accuracy} · 유창성 ${m.fluency} · 완급 ${m.prosody} 기준 추정치입니다.` },
    },
    strengths: [
      '전달 의도가 분명하고 답변을 끝까지 완성했습니다.',
      '핵심 키워드의 발음이 명료합니다.',
    ],
    improvements: [
      '문장 사이의 멈춤을 줄여 유창성(Fluency)을 끌어올리세요.',
      '강세와 억양(Prosody)에 변화를 주어 단조로움을 줄이세요.',
    ],
    general_feedback:
      `현재 추정 밴드는 ${band}입니다. (외부 발음평가 키 미설정 — 음성 길이 기반 샘플 리포트) ` +
      '매일 60초 즉답 훈련으로 멈춤을 줄이고, 들은 문장을 따라 말하는 쉐도잉으로 억양을 다듬으면 다음 밴드 진입이 가능합니다. 꾸준함이 점수를 만듭니다!',
  };
}
