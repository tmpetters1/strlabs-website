import type { Axis, Cubie, FaceId, Move } from './types';
import { FACE_AXIS, FACE_SIGN } from './types';

type Vec3 = [number, number, number];

function rotate90Pos(axis: Axis, [x, y, z]: Vec3): Vec3 {
  switch (axis) {
    case 'x': return [x, -z, y];
    case 'y': return [z, y, -x];
    case 'z': return [-y, x, z];
  }
}

function rotateVec(axis: Axis, v: Vec3, quarterTurns: number): Vec3 {
  let k = ((quarterTurns % 4) + 4) % 4;
  let out = v;
  for (let i = 0; i < k; i++) out = rotate90Pos(axis, out);
  return out;
}

export function createCubies(n: number): Cubie[] {
  const offset = (n - 1) / 2;
  const cubies: Cubie[] = [];
  let id = 0;
  for (let xi = 0; xi < n; xi++) {
    for (let yi = 0; yi < n; yi++) {
      for (let zi = 0; zi < n; zi++) {
        const isOuter = xi === 0 || xi === n - 1 || yi === 0 || yi === n - 1 || zi === 0 || zi === n - 1;
        if (!isOuter) continue; // no interior cubies needed
        cubies.push({
          id: id++,
          pos: [xi - offset, yi - offset, zi - offset],
          basis: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
        });
      }
    }
  }
  return cubies;
}

// Returns the quarter-turn count (right-hand-rule, positive convention) for one clockwise face turn.
function faceQuarterTurns(face: FaceId, turns: number): number {
  const sign = FACE_SIGN[face];
  return -sign * turns;
}

export function selectMoveCubies(cubies: Cubie[], n: number, move: Move): Cubie[] {
  const axis: Axis = move.slice
    ? (move.slice === 'M' ? 'x' : move.slice === 'E' ? 'y' : 'z')
    : FACE_AXIS[move.face];

  if (move.slice) {
    // Slice moves only make clean sense for odd N (single middle layer).
    if (n % 2 === 0) return [];
    return cubies.filter((c) => {
      const coord = axis === 'x' ? c.pos[0] : axis === 'y' ? c.pos[1] : c.pos[2];
      return Math.abs(coord) < 0.5;
    });
  }

  const sign = FACE_SIGN[move.face];
  const maxCoord = (n - 1) / 2;
  const threshold = maxCoord - move.depth + 0.5;
  return cubies.filter((c) => {
    const coord = axis === 'x' ? c.pos[0] : axis === 'y' ? c.pos[1] : c.pos[2];
    return sign * coord > threshold;
  });
}

export function applyMoveToCubies(cubies: Cubie[], n: number, move: Move): Cubie[] {
  const axis: Axis = move.slice
    ? (move.slice === 'M' ? 'x' : move.slice === 'E' ? 'y' : 'z')
    : FACE_AXIS[move.face];

  const selected = selectMoveCubies(cubies, n, move);
  const selectedIds = new Set(selected.map((c) => c.id));

  // Slice moves M/E/S follow the direction of L/D/S-per-convention faces.
  const sliceEquivFace: FaceId | undefined =
    move.slice === 'M' ? 'L' : move.slice === 'E' ? 'D' : move.slice === 'S' ? 'F' : undefined;
  const quarterTurns = move.slice
    ? faceQuarterTurns(sliceEquivFace!, move.turns)
    : faceQuarterTurns(move.face, move.turns);

  return cubies.map((c) => {
    if (!selectedIds.has(c.id)) return c;
    const newPos = rotateVec(axis, c.pos, quarterTurns);
    const newBasis: Cubie['basis'] = [
      rotateVec(axis, c.basis[0], quarterTurns),
      rotateVec(axis, c.basis[1], quarterTurns),
      rotateVec(axis, c.basis[2], quarterTurns),
    ];
    return { ...c, pos: newPos, basis: newBasis };
  });
}

// Given a cubie's original (solved) position, what world-facing direction was originally
// the U/D/L/R/F/B sticker (unit vector), and where does it point to now (via basis)?
export function stickerWorldDirections(c: Cubie): Vec3[] {
  // basis columns tell us where local +x,+y,+z now point.
  return c.basis;
}
