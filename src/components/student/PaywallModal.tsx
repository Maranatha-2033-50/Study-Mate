'use client';

import Link from 'next/link';
import { Crown, Sparkles, X, ArrowRight } from 'lucide-react';
import { PAYWALL_MESSAGE } from '@/lib/subscription';

/* ── 동적 페이월 유도 모달 — 등급/횟수 초과 시 구독 업그레이드 유도 (Phase 13) ──
   시험 시작·훈련 입장·선생님께 질문하기 등에서 권한 초과 순간 띄운다. */
export function PaywallModal({
  open, onClose, title = '업그레이드가 필요해요', feature,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  feature?: string;   // 초과한 기능명 (예: '실전 모의고사', '1:1 선생님 질문')
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 px-4 py-6 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/20"
        >
          <X size={16} />
        </button>

        {/* 그라데이션 헤더 */}
        <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-7 pb-8 pt-9 text-white">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur">
            <Crown size={13} /> PREMIUM
          </span>
          <h3 className="mt-4 text-xl font-extrabold leading-snug">{title}</h3>
          {feature && (
            <p className="mt-1 text-sm font-medium text-indigo-100">
              <Sparkles size={13} className="mb-0.5 mr-1 inline" />
              {feature}
            </p>
          )}
        </div>

        {/* 본문 + CTA */}
        <div className="px-7 py-6">
          <p className="text-sm leading-7 text-slate-600">{PAYWALL_MESSAGE}</p>

          <Link
            href="/student/mypage"
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl
                       bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3.5 text-sm font-bold
                       text-white shadow-md shadow-indigo-200 transition-all hover:shadow-lg"
          >
            <Crown size={16} /> 구독 업그레이드 하러 가기
            <ArrowRight size={16} />
          </Link>
          <button
            onClick={onClose}
            className="mt-2.5 w-full rounded-xl px-5 py-3 text-sm font-semibold text-slate-400 hover:bg-slate-50"
          >
            다음에 할게요
          </button>
        </div>
      </div>
    </div>
  );
}
