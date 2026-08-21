import { useCallback, useEffect, useState } from 'react';
import type { FaceId } from '../cube/types';

export type BindableAction = FaceId;

export const BINDABLE_ACTIONS: BindableAction[] = ['U', 'D', 'L', 'R', 'F', 'B'];

export const DEFAULT_BINDINGS: Record<BindableAction, string> = {
  U: 'ArrowUp',
  D: 'ArrowDown',
  L: 'ArrowLeft',
  R: 'ArrowRight',
  F: 'Space',
  B: 'KeyB',
};

const STORAGE_KEY = 'cube-coach-keybindings';

function loadBindings(): Record<BindableAction, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BINDINGS };
    const parsed = JSON.parse(raw);
    const merged = { ...DEFAULT_BINDINGS };
    for (const action of BINDABLE_ACTIONS) {
      if (typeof parsed[action] === 'string') merged[action] = parsed[action];
    }
    return merged;
  } catch {
    return { ...DEFAULT_BINDINGS };
  }
}

export function useKeyBindings() {
  const [bindings, setBindings] = useState<Record<BindableAction, string>>(() => loadBindings());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
    } catch {
      // localStorage unavailable (private mode, etc.) - bindings just won't persist.
    }
  }, [bindings]);

  const setBinding = useCallback((action: BindableAction, code: string) => {
    setBindings((prev) => {
      const next = { ...prev };
      // Keep bindings 1:1 - if another action already owns this key, clear it there first.
      for (const other of BINDABLE_ACTIONS) {
        if (other !== action && next[other] === code) next[other] = '';
      }
      next[action] = code;
      return next;
    });
  }, []);

  const resetBindings = useCallback(() => {
    setBindings({ ...DEFAULT_BINDINGS });
  }, []);

  return { bindings, setBinding, resetBindings };
}
