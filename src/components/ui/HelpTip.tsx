'use client';

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';

/* ────────────────────────────────────────────────────────────────────────────
   인라인 물음표 가이드 마크 (?)
   - 코어 UX 컨트롤 옆에 심어 hover/focus/click 시 간결한 작동 원리 툴팁을 띄운다.
   - 키보드 접근성(focus/blur) 및 모바일 탭(click 토글) 지원.
──────────────────────────────────────────────────────────────────────────── */
export function HelpTip({
  text,
  label = '도움말',
  align = 'center',
}: {
  text: string;
  label?: string;
  align?: 'left' | 'center' | 'right';
}) {
  const [open, setOpen] = useState(false);

  const pos =
    align === 'left'  ? 'left-0'
    : align === 'right' ? 'right-0'
    : 'left-1/2 -translate-x-1/2';

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        className="text-slate-300 transition-colors hover:text-indigo-500 focus:text-indigo-500 focus:outline-none"
      >
        <HelpCircle size={14} />
      </button>
      {open && (
        <span
          role="tooltip"
          className={`absolute top-full z-50 mt-1.5 w-56 rounded-lg bg-slate-900 px-3 py-2
                      text-[11px] font-medium leading-5 text-white shadow-lg ${pos}`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
