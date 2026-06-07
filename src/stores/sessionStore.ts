import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SessionDraft } from '@/types';

interface SessionStore {
  drafts: Record<string, SessionDraft>;  // sessionId → draft
  saveDraft: (draft: SessionDraft) => void;
  getDraft: (sessionId: string) => SessionDraft | undefined;
  clearDraft: (sessionId: string) => void;
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      drafts: {},

      saveDraft: (draft) =>
        set((state) => ({
          drafts: { ...state.drafts, [draft.sessionId]: draft },
        })),

      getDraft: (sessionId) => get().drafts[sessionId],

      clearDraft: (sessionId) =>
        set((state) => {
          const next = { ...state.drafts };
          delete next[sessionId];
          return { drafts: next };
        }),
    }),
    {
      name: 'ai-learning-session-drafts',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
