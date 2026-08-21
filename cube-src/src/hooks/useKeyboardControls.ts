import { useEffect } from 'react';
import type { FaceId, Move } from '../cube/types';

const CODE_TO_FACE: Record<string, FaceId> = {
  ArrowUp: 'U',
  ArrowDown: 'D',
  ArrowLeft: 'L',
  ArrowRight: 'R',
  Space: 'F',
  AltLeft: 'B',
  AltRight: 'B',
};

const CAPTURED_CODES = new Set(Object.keys(CODE_TO_FACE));

export function useKeyboardControls(n: number, onMove: (move: Move) => void, disabled: boolean) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!CAPTURED_CODES.has(e.code)) return;
      e.preventDefault();
      if (disabled || e.repeat) return;

      const face = CODE_TO_FACE[e.code];
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
      if (CAPTURED_CODES.has(e.code)) e.preventDefault();
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [n, onMove, disabled]);
}
