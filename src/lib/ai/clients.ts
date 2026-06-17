/* ────────────────────────────────────────────────────────────────────────────
   서버 전용 LLM 클라이언트 — 도메인별 엔진 스위칭
   - callOpenAI : 어학 에세이 첨삭 (gpt-4o-mini)
   - callSolar  : 자격증·국내외 교과 맹점 분석 (Upstage Solar, 한국어 최적화)
   두 제공자 모두 OpenAI 호환 /chat/completions 규격을 사용한다.
   전용 키(OPENAI_API_KEY / SOLAR_API_KEY) 미설정 시 기존 범용 AI_* 설정으로
   폴백하여 현행 동작을 유지한다. 키는 서버(process.env)에서만 읽으며 클라이언트로
   절대 노출되지 않는다.
──────────────────────────────────────────────────────────────────────────── */

interface ChatParams {
  system: string;
  user: string;
  maxTokens?: number;
  json?: boolean;
}

interface Engine { base: string; key: string; model: string }

async function chat(engine: Engine, p: ChatParams): Promise<string> {
  if (!engine.key) throw new Error('AI key is not configured');

  const res = await fetch(`${engine.base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${engine.key}` },
    body: JSON.stringify({
      model: engine.model,
      max_tokens: p.maxTokens ?? 2048,
      ...(p.json ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        { role: 'system', content: p.system },
        { role: 'user',   content: p.user },
      ],
    }),
  });

  if (!res.ok) throw new Error(`AI API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? '').trim();
}

/** OpenAI (gpt-4o-mini) — 어학 에세이 첨삭용 */
export function callOpenAI(p: ChatParams): Promise<string> {
  const hasKey = !!process.env.OPENAI_API_KEY;
  return chat({
    base:  process.env.OPENAI_BASE_URL ?? (hasKey ? 'https://api.openai.com/v1' : (process.env.AI_BASE_URL ?? 'https://api.openai.com/v1')),
    key:   process.env.OPENAI_API_KEY  ?? process.env.AI_API_KEY ?? '',
    model: process.env.OPENAI_MODEL    ?? (hasKey ? 'gpt-4o-mini' : (process.env.AI_MODEL ?? 'gpt-4o-mini')),
  }, p);
}

/** Upstage Solar — 자격증·교과 한국어 맹점 분석용 */
export function callSolar(p: ChatParams): Promise<string> {
  const hasKey = !!process.env.SOLAR_API_KEY;
  return chat({
    base:  process.env.SOLAR_BASE_URL ?? (hasKey ? 'https://api.upstage.ai/v1' : (process.env.AI_BASE_URL ?? 'https://api.upstage.ai/v1')),
    key:   process.env.SOLAR_API_KEY  ?? process.env.AI_API_KEY ?? '',
    model: process.env.SOLAR_MODEL    ?? (hasKey ? 'solar-pro' : (process.env.AI_MODEL ?? 'solar-pro')),
  }, p);
}
