'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Pause, Play, Trash2, CheckCircle2, Send } from 'lucide-react';

type Status = 'idle' | 'recording' | 'paused' | 'stopped';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

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
  const [packaged, setPackaged] = useState(false);

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
      setBlob(null); setPackaged(false); setElapsed(0); setStatus('recording');
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
    setBlob(null); setUrl(null); setElapsed(0); setPackaged(false); setStatus('idle');
  };

  // 녹음 완료 → 백엔드 전송용 패키징 (FormData 준비)
  const packageForUpload = () => {
    if (!blob) return;
    const form = new FormData();
    form.append('audio', blob, `speaking-${elapsed}s.webm`);
    form.append('duration', String(elapsed));
    // TODO: 백엔드 스피킹 채점 라우트 연결 시 fetch('/api/ai/speaking', { method:'POST', body: form })
    setPackaged(true);
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

      {/* 녹음 결과 미리듣기 + 전송 준비 */}
      {url && (
        <div className="mt-5 space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={url} controls className="w-full" />
          <button
            onClick={packageForUpload}
            disabled={packaged}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            <Send size={15} /> {packaged ? '전송 준비 완료 ✓' : '제출 준비 (백엔드 전송 패키징)'}
          </button>
          {packaged && (
            <p className="text-xs text-emerald-600">
              음원 파일이 FormData로 패키징되었습니다 (스피킹 채점 라우트 연결 시 즉시 전송).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
