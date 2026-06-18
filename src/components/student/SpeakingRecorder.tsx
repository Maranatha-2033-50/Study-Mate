'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Pause, Play, Trash2, CheckCircle2, Send, Loader2, Award } from 'lucide-react';
import type { SpeakingFeedback } from '@/types';

type Status = 'idle' | 'recording' | 'paused' | 'stopped';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const METRIC_META: { key: keyof SpeakingFeedback['metrics']; label: string; bar: string }[] = [
  { key: 'accuracy', label: '발음 정확도', bar: 'bg-emerald-500' },
  { key: 'fluency',  label: '유창성',      bar: 'bg-indigo-500' },
  { key: 'prosody',  label: '완급·억양',   bar: 'bg-violet-500' },
];

/* IELTS/DELF 스피킹 시험장 — MediaRecorder 기반 녹음기 */
export function SpeakingRecorder() {
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [status, setStatus] = useState<Status>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [feedback, setFeedback] = useState<SpeakingFeedback | null>(null);
  const [submitError, setSubmitError] = useState('');

  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  const stopStream = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };

  // 언마운트 시 마이크 스트림·타이머 정리 (누수 방지)
  useEffect(() => {
    return () => {
      stopTimer();
      stopStream();
      if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const b = new Blob(chunksRef.current, { type: mime || 'audio/webm' });
        setBlob(b);
        setUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(b); });
        stopStream();
      };
      rec.start();
      recRef.current = rec;
      setBlob(null); setFeedback(null); setSubmitError(''); setElapsed(0); setStatus('recording');
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      setError('마이크 접근이 거부되었거나 사용할 수 없습니다. 브라우저 권한을 확인하세요.');
    }
  };

  const pause = () => { recRef.current?.pause(); stopTimer(); setStatus('paused'); };
  const resume = () => {
    recRef.current?.resume();
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    setStatus('recording');
  };
  const stop = () => { recRef.current?.stop(); stopTimer(); setStatus('stopped'); };
  const reset = () => {
    if (url) URL.revokeObjectURL(url);
    setBlob(null); setUrl(null); setElapsed(0); setFeedback(null); setSubmitError(''); setStatus('idle');
  };

  // 녹음 완료 → /api/ai/speaking 으로 음원 전송 후 IELTS 밴드 리포트 수신
  const submit = async () => {
    if (!blob || analyzing) return;
    setAnalyzing(true);
    setSubmitError('');
    try {
      const form = new FormData();
      form.append('audio', blob, `speaking-${elapsed}s.webm`);
      form.append('duration', String(elapsed));
      const res = await fetch('/api/ai/speaking', { method: 'POST', body: form });
      if (!res.ok) throw new Error('채점 요청 실패');
      const { feedback: fb } = (await res.json()) as { feedback: SpeakingFeedback };
      setFeedback(fb);
    } catch {
      setSubmitError('AI 채점 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
          <Mic size={18} />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Speaking</p>
          <p className="text-sm font-bold text-slate-800">스피킹 답변 녹음</p>
        </div>
        {/* 녹음 상태 뱃지 */}
        {status === 'recording' && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" /> REC {fmt(elapsed)}
          </span>
        )}
        {status === 'paused' && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-600">
            ⏸ 일시정지 {fmt(elapsed)}
          </span>
        )}
        {status === 'stopped' && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">
            <CheckCircle2 size={13} /> 녹음 완료 ({fmt(elapsed)})
          </span>
        )}
      </div>

      {/* 컨트롤 */}
      <div className="flex flex-wrap items-center gap-2.5">
        {status === 'idle' && (
          <button onClick={start} className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-600">
            <Mic size={16} /> 녹음 시작
          </button>
        )}
        {status === 'recording' && (
          <>
            <button onClick={pause} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              <Pause size={16} /> 일시정지
            </button>
            <button onClick={stop} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700">
              <Square size={15} /> 정지
            </button>
          </>
        )}
        {status === 'paused' && (
          <>
            <button onClick={resume} className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-600">
              <Play size={16} /> 재개
            </button>
            <button onClick={stop} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700">
              <Square size={15} /> 정지
            </button>
          </>
        )}
        {status === 'stopped' && (
          <button onClick={reset} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            <Trash2 size={16} /> 다시 녹음
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-xs text-rose-500">{error}</p>}

      {/* 녹음 결과 미리듣기 + AI 채점 제출 */}
      {url && !feedback && (
        <div className="mt-5 space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={url} controls className="w-full" />
          <button
            onClick={submit}
            disabled={analyzing}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            <Send size={15} /> AI 발음·유창성 채점 받기
          </button>
          {submitError && <p className="text-xs text-rose-500">{submitError}</p>}
        </div>
      )}

      {/* 음성 분석 프로그레스 스켈레톤 (대용량 업로드 + AI 구동 중 이탈 방지) */}
      {analyzing && (
        <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/60 p-5">
          <p className="flex items-center gap-2 text-sm font-bold text-indigo-700">
            <Loader2 size={16} className="animate-spin" />
            AI가 당신의 발음과 억양을 정밀 분석 중입니다 (약 10초 소요)…
          </p>
          <div className="mt-4 space-y-2.5">
            {METRIC_META.map((m) => (
              <div key={m.key} className="space-y-1">
                <div className="h-2.5 w-24 animate-pulse rounded bg-indigo-200/70" />
                <div className="h-2 w-full animate-pulse rounded-full bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* IELTS 스피킹 밴드 리포트 카드 */}
      {feedback && (
        <div className="mt-5 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {/* 밴드 헤더 */}
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 flex-none flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
              <Award size={16} />
              <span className="text-xl font-black leading-none">{feedback.band_score}</span>
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-500">IELTS Speaking</p>
              <p className="text-lg font-extrabold text-slate-900">예상 밴드 {feedback.band_score}</p>
            </div>
          </div>

          {/* 발음 지표 바 */}
          <div className="space-y-2.5">
            {METRIC_META.map((m) => {
              const v = feedback.metrics[m.key];
              return (
                <div key={m.key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-600">{m.label}</span>
                    <span className="font-bold text-slate-500">{v}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-2 rounded-full ${m.bar}`} style={{ width: `${Math.max(0, Math.min(100, v))}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 영역별 평가 */}
          <div className="space-y-1.5">
            {Object.entries(feedback.criteria).map(([name, c]) => (
              <div key={name} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <span className="flex-none rounded-md bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">{c.score}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700">{name}</p>
                  <p className="text-xs text-slate-500">{c.comment}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 강점 / 개선점 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
              <p className="mb-1.5 text-xs font-bold text-emerald-700">강점</p>
              <ul className="space-y-1 text-xs text-emerald-800">
                {feedback.strengths.map((s, i) => <li key={i}>• {s}</li>)}
              </ul>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
              <p className="mb-1.5 text-xs font-bold text-amber-700">개선점</p>
              <ul className="space-y-1 text-xs text-amber-800">
                {feedback.improvements.map((s, i) => <li key={i}>• {s}</li>)}
              </ul>
            </div>
          </div>

          {/* 총평 */}
          <div className="rounded-xl bg-slate-900 p-4 text-sm leading-relaxed text-slate-100">
            {feedback.general_feedback}
          </div>

          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            <Trash2 size={16} /> 새로 녹음하기
          </button>
        </div>
      )}
    </div>
  );
}
