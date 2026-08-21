import { useEffect } from 'react';
import type { FaceId, Move } from '../cube/types';
import type { BindableAction } from './useKeyBindings';
import { keyCaptureLock } from './keyCaptureLock';

export function useKeyboardControls(
  n: number,
  onMove: (move: Move) => void,
  disabled: boolean,
  bindings: Record<BindableAction, string>
) {
  useEffect(() => {
    const codeToFace: Partial<Record<string, FaceId>> = {};
    (Object.keys(bindings) as FaceId[]).forEach((face) => {
      if (bindings[face]) codeToFace[bindings[face]] = face;
    });
    const capturedCodes = new Set(Object.keys(codeToFace));

    function handleKeyDown(e: KeyboardEvent) {
      if (!capturedCodes.has(e.code)) return;
      if (keyCaptureLock.locked) return;
      e.preventDefault();
      if (disabled || e.repeat) return;

      const face = codeToFace[e.code]!;
      const prime = e.shiftKey;
      const wide = e.ctrlKey && n > 3;
      const move: Move = {
        face,
        depth: wide ? 2 : 1,
        turns: prime ? 3 : 1,
      };
      onMove(move);
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (capturedCodes.has(e.code)) e.preventDefault();
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [n, onMove, disabled, bindings]);
}
