import type { FaceId, Move } from './types';

const SLICE_LETTERS = new Set(['M', 'E', 'S']);

// Parses standard cube notation ("R U R' U R U2 R'") into Move objects.
// Only face turns (U D L R F B) and slice turns (M E S) are supported -
// no whole-cube rotations (x/y/z), so every token maps to a real button press.
export function parseAlgorithm(source: string): Move[] {
  return source
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(parseToken);
}

function parseToken(token: string): Move {
  const letter = token[0];
  const rest = token.slice(1);
  const turns = rest.startsWith('2') ? 2 : rest.startsWith("'") ? 3 : 1;
  if (SLICE_LETTERS.has(letter)) {
    return { face: 'U', depth: 1, slice: letter as 'M' | 'E' | 'S', turns };
  }
  return { face: letter as FaceId, depth: 1, turns };
}
