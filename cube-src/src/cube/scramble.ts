import type { FaceId, Move } from './types';

const FACES: FaceId[] = ['U', 'D', 'L', 'R', 'F', 'B'];

export function randomScramble(n: number, length = n <= 3 ? 20 : n === 4 ? 32 : 45): Move[] {
  const moves: Move[] = [];
  let lastFace: FaceId | null = null;
  for (let i = 0; i < length; i++) {
    let face: FaceId;
    do {
      face = FACES[Math.floor(Math.random() * FACES.length)];
    } while (face === lastFace);
    lastFace = face;
    const wide = n > 3 && Math.random() < 0.4;
    const turns = ([1, 2, 3] as const)[Math.floor(Math.random() * 3)];
    moves.push({ face, depth: wide ? 2 : 1, turns });
  }
  return moves;
}
