'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Headphones, Mic, ArrowLeft } from 'lucide-react';
import { AudioPlayer } from '@/components/student/AudioPlayer';
import { SpeakingRecorder } from '@/components/student/SpeakingRecorder';

export default function LangStudioPage() {
  const [tab, setTab] = useState<'listening' | 'speaking'>('listening');
  // 리스닝 데모 음원 — Supabase Storage 공개 mp3 URL 등을 env 로 주입(미설정 시 플레이어 비활성 안내).
  // 문항 구동형 리스닝 도입 시 question.audio_url 을 src 로 바인딩하면 된다.
  const listeningSrc = process.env.NEXT_PUBLIC_LISTENING_SAMPLE_URL || undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-2 py-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">Language Studio</p>
          <h1 className="mt-1 text-2xl font-extrabold leading-tight text-slate-900">어학 실전 스튜디오</h1>
          <p className="mt-0.5 text-sm text-slate-400">IELTS·DELF 리스닝 음원과 스피킹 녹음을 실전 환경으로 연습하세요.</p>
        </div>
        <Link
          href="/student/lang"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-500 transition-colors hover:border-indigo-300 hover:text-indigo-600"
        >
          <ArrowLeft size={15} /> 어학 홈
        </Link>
      </div>

      {/* 탭 */}
      <div className="flex gap-2">
        {([
          { key: 'listening', label: '리스닝', icon: Headphones },
          { key: 'speaking',  label: '스피킹', icon: Mic },
        ] as const).map((t) => {
          const on = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors
                ${on ? 'bg-indigo-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600'}`}
            >
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'listening' ? <AudioPlayer title="IELTS Listening — Section 1" src={listeningSrc} /> : <SpeakingRecorder />}
    </div>
  );
}
