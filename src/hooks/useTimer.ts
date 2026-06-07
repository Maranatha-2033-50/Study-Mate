'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tracks the pure "active focus time" a user spends on each question.
 * Pauses automatically when the tab is hidden or when explicitly paused.
 *
 * Usage:
 *   const { getElapsed, switchQuestion, pause, resume, reset } = useTimer(questionId);
 */
export function useTimer(questionIds: string[]) {
  // accumulated seconds per question_id
  const [elapsed, setElapsed] = useState<Record<string, number>>(() =>
    Object.fromEntries(questionIds.map((id) => [id, 0]))
  );

  const activeIdRef     = useRef<string | null>(null);
  const startTimeRef    = useRef<number>(Date.now());
  const isPausedRef     = useRef(false);

  // Flush accumulated time for the currently active question
  const flush = useCallback(() => {
    if (activeIdRef.current === null || isPausedRef.current) return;
    const delta = Math.floor((Date.now() - startTimeRef.current) / 1000);
    if (delta <= 0) return;
    setElapsed((prev) => ({
      ...prev,
      [activeIdRef.current!]: (prev[activeIdRef.current!] ?? 0) + delta,
    }));
    startTimeRef.current = Date.now();
  }, []);

  // Switch to a new question — flushes time for the previous one
  const switchQuestion = useCallback(
    (newId: string) => {
      flush();
      activeIdRef.current  = newId;
      startTimeRef.current = Date.now();
      isPausedRef.current  = false;
    },
    [flush]
  );

  const pause = useCallback(() => {
    flush();
    isPausedRef.current = true;
  }, [flush]);

  const resume = useCallback(() => {
    if (!isPausedRef.current) return;
    isPausedRef.current  = false;
    startTimeRef.current = Date.now();
  }, []);

  // Reset all timers (after submission)
  const reset = useCallback(() => {
    activeIdRef.current = null;
    setElapsed(Object.fromEntries(questionIds.map((id) => [id, 0])));
  }, [questionIds]);

  // Auto-pause when tab loses visibility
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        pause();
      } else {
        resume();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [pause, resume]);

  // Flush on unmount so time is never lost
  useEffect(() => () => { flush(); }, [flush]);

  const getElapsed = useCallback(
    (id: string): number => {
      const stored = elapsed[id] ?? 0;
      // Add live delta if this is the currently active question
      if (id === activeIdRef.current && !isPausedRef.current) {
        return stored + Math.floor((Date.now() - startTimeRef.current) / 1000);
      }
      return stored;
    },
    [elapsed]
  );

  return { elapsed, getElapsed, switchQuestion, pause, resume, reset };
}
