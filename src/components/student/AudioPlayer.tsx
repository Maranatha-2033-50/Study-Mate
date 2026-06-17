'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, Headphones, RotateCcw } from 'lucide-react';

const fmt = (s: number) => {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
};

/* IELTS/DELF 리스닝 모의고사용 오디오 플레이어 — 커스텀 컨트롤바 */
export function AudioPlayer({ src, title = 'Listening Section' }: { src?: string; title?: string }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(1);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const onTime = () => setCur(a.currentTime);
    const onMeta = () => { setDur(a.duration); setReady(true); };
    const onEnd = () => setPlaying(false);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('ended', onEnd);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('ended', onEnd);
    };
  }, [src]);

  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); }
  };

  const seek = (v: number) => { if (ref.current) { ref.current.currentTime = v; setCur(v); } };
  const restart = () => seek(0);
  const changeVol = (v: number) => { if (ref.current) { ref.current.volume = v; setVol(v); } };

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
          <Headphones size={18} />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Listening</p>
          <p className="text-sm font-bold">{title}</p>
        </div>
        <span className="ml-auto font-mono text-xs text-slate-400">{fmt(cur)} / {fmt(dur)}</span>
      </div>

      {/* seek bar */}
      <input
        type="range"
        min={0}
        max={dur || 0}
        step={0.1}
        value={cur}
        onChange={(e) => seek(Number(e.target.value))}
        className="mb-4 w-full accent-indigo-400"
        disabled={!ready}
      />

      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          disabled={!src}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-white transition-colors hover:bg-indigo-500 disabled:opacity-40"
          aria-label={playing ? '일시정지' : '재생'}
        >
          {playing ? <Pause size={20} /> : <Play size={20} className="translate-x-0.5" />}
        </button>
        <button onClick={restart} disabled={!src} className="text-slate-300 hover:text-white disabled:opacity-40" aria-label="처음으로">
          <RotateCcw size={18} />
        </button>
        <div className="ml-auto flex items-center gap-2">
          <Volume2 size={16} className="text-slate-400" />
          <input
            type="range" min={0} max={1} step={0.05} value={vol}
            onChange={(e) => changeVol(Number(e.target.value))}
            className="w-24 accent-indigo-400"
          />
        </div>
      </div>

      {!src && (
        <p className="mt-4 rounded-lg bg-white/5 px-3 py-2 text-center text-xs text-slate-400">
          음성 지문(mp3) 소스가 연결되면 즉시 재생됩니다. (시험 문항별 audio_url 연동 예정)
        </p>
      )}

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={ref} src={src} preload="metadata" />
    </div>
  );
}
