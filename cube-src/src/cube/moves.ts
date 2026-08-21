import type { FaceId, Move } from './types';

const FACE_KEYS: FaceId[] = ['U', 'D', 'L', 'R', 'F', 'B'];

export function faceMove(face: FaceId, prime: boolean, double = false, wide = false): Move {
  return {
    face,
    depth: wide ? 2 : 1,
    turns: double ? 2 : prime ? 3 : 1,
  };
}

export function sliceMove(slice: 'M' | 'E' | 'S', prime: boolean, double = false): Move {
  return { face: 'U', depth: 1, slice, turns: double ? 2 : prime ? 3 : 1 };
}

export function invertMove(move: Move): Move {
  const invertedTurns = move.turns === 2 ? 2 : move.turns === 1 ? 3 : 1;
  return { ...move, turns: invertedTurns };
}

export function moveToNotation(move: Move): string {
  const turnSuffix = move.turns === 2 ? '2' : move.turns === 3 ? "'" : '';
  if (move.slice) return `${move.slice}${turnSuffix}`;
  const wideSuffix = move.depth > 1 ? 'w' : '';
  return `${move.face}${wideSuffix}${turnSuffix}`;
}

export { FACE_KEYS };
