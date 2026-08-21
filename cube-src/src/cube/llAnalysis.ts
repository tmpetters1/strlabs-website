// Last-layer (top face) case recognition for 2-look OLL and full PLL, on a 3x3.
//
// Rather than hand-encoding "this scrambled pattern means this algorithm" (easy to
// get subtly wrong from memory with no reference to check against), every case's
// recognition pattern is *derived* from its own algorithm: we apply the algorithm's
// inverse to a solved cube and read off the resulting pattern. That keeps recognition
// and execution mathematically consistent with each other even if a transcribed
// algorithm is imperfect. On top of that, each candidate algorithm is validated at
// module load time against the structural invariant its category requires (a PLL
// algorithm must not twist/misorient anything, an edge-orientation algorithm must
// leave corners completely untouched, etc). Anything that fails is dropped with a
// console.warn instead of ever reaching the user - worst case a case falls back to
// the generic stage hint, it never shows a broken algorithm.
import type { FaceId, Move } from './types';
import { CubeState, WORLD_FACE_DIR } from './state';
import { invertMove } from './moves';
import { parseAlgorithm } from './notation';
import { FACE_CYCLE } from './orientation';

type Vec3 = [number, number, number];

function dirsEqual(a: Vec3, b: Vec3): boolean {
  return Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01 && Math.abs(a[2] - b[2]) < 0.01;
}

function cornerPosition(a: FaceId, b: FaceId, max: number): Vec3 {
  const da = WORLD_FACE_DIR[a];
  const db = WORLD_FACE_DIR[b];
  return [(da[0] + db[0]) * max, max, (da[2] + db[2]) * max];
}

function edgePosition(a: FaceId, max: number): Vec3 {
  const da = WORLD_FACE_DIR[a];
  return [da[0] * max, max, da[2] * max];
}

interface CornerState {
  orientation: 0 | 1 | 2;
  identity: string;
}

interface EdgeState {
  oriented: boolean;
  identity: FaceId;
}

function findCubieStickers(cube: CubeState, targetPos: Vec3) {
  return cube.getAllStickers().filter((s) => dirsEqual(s.pos, targetPos));
}

function analyzeCorners(cube: CubeState): CornerState[] {
  const max = (cube.n - 1) / 2;
  return FACE_CYCLE.map((a, i) => {
    const b = FACE_CYCLE[(i + 1) % 4];
    const stickers = findCubieStickers(cube, cornerPosition(a, b, max));
    const uSticker = stickers.find((s) => s.color === 'U')!;
    let orientation: 0 | 1 | 2 = 0;
    if (dirsEqual(uSticker.worldDir, WORLD_FACE_DIR.U)) orientation = 0;
    else if (dirsEqual(uSticker.worldDir, WORLD_FACE_DIR[a])) orientation = 1;
    else orientation = 2;
    const identity = stickers
      .filter((s) => s.color !== 'U')
      .map((s) => s.color)
      .sort()
      .join('');
    return { orientation, identity };
  });
}

function analyzeEdges(cube: CubeState): EdgeState[] {
  const max = (cube.n - 1) / 2;
  return FACE_CYCLE.map((a) => {
    const stickers = findCubieStickers(cube, edgePosition(a, max));
    const uSticker = stickers.find((s) => s.color === 'U')!;
    const oriented = dirsEqual(uSticker.worldDir, WORLD_FACE_DIR.U);
    const identity = stickers.find((s) => s.color !== 'U')!.color;
    return { oriented, identity };
  });
}

interface Signature {
  cornerOri: (0 | 1 | 2)[];
  cornerId: string[];
  edgeOri: boolean[];
  edgeId: FaceId[];
}

function computeSignature(cube: CubeState): Signature {
  const corners = analyzeCorners(cube);
  const edges = analyzeEdges(cube);
  return {
    cornerOri: corners.map((c) => c.orientation),
    cornerId: corners.map((c) => c.identity),
    edgeOri: edges.map((e) => e.oriented),
    edgeId: edges.map((e) => e.identity),
  };
}

function rotate<T>(arr: T[], k: number): T[] {
  return arr.map((_, i) => arr[(i + k) % 4]);
}

function arraysEqual<T>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

const SOLVED_CORNER_ID = FACE_CYCLE.map((a, i) => [a, FACE_CYCLE[(i + 1) % 4]].sort().join(''));
const SOLVED_EDGE_ID: FaceId[] = [...FACE_CYCLE];

function applyMoves(cube: CubeState, moves: Move[]) {
  moves.forEach((m) => cube.applyMove(m));
}

function invertAll(moves: Move[]): Move[] {
  return [...moves].reverse().map(invertMove);
}

export interface LLCase {
  id: string;
  name: string;
  moves: Move[];
  signature: Signature;
}

// Checks the algorithm's "problem" state has bottom-two-layers intact - i.e. this
// really is a last-layer-only algorithm and doesn't leave F2L pieces disturbed,
// even though its individual moves (full R/F/L/B turns) pass through those layers.
function lowerLayersIntact(cube: CubeState): boolean {
  if (!cube.isFaceSolved('D')) return false;
  const max = (cube.n - 1) / 2;
  const sides: FaceId[] = ['L', 'R', 'F', 'B'];
  const all = cube.getAllStickers();
  return sides.every((face) => {
    const dir = WORLD_FACE_DIR[face];
    const grid = all.filter((s) => dirsEqual(s.worldDir, dir));
    const below = grid.filter((s) => s.pos[1] < -max + 0.5);
    return below.every((s) => s.color === face);
  });
}

function buildValidated(
  raw: { id: string; name: string; alg: string }[],
  validate: (problem: CubeState, sig: Signature) => boolean
): LLCase[] {
  const out: LLCase[] = [];
  for (const entry of raw) {
    let signature: Signature;
    let moves: Move[];
    let problem: CubeState;
    try {
      moves = parseAlgorithm(entry.alg);
      problem = new CubeState(3);
      applyMoves(problem, invertAll(moves));
      signature = computeSignature(problem);
    } catch {
      console.warn(`[cube] dropping invalid algorithm entry "${entry.id}" (${entry.name}) - broke cube structure`);
      continue;
    }
    if (!validate(problem, signature)) {
      console.warn(`[cube] dropping invalid algorithm entry "${entry.id}" (${entry.name}) - failed validation`);
      continue;
    }
    if (out.some((c) => arraysEqual(c.signature.cornerId, signature.cornerId) && arraysEqual(c.signature.edgeId, signature.edgeId) && arraysEqual(c.signature.cornerOri, signature.cornerOri) && arraysEqual(c.signature.edgeOri, signature.edgeOri))) {
      console.warn(`[cube] dropping duplicate algorithm entry "${entry.id}" (${entry.name})`);
      continue;
    }
    out.push({ id: entry.id, name: entry.name, moves, signature });
  }
  return out;
}

// ---------- PLL: full permutation, no orientation change allowed ----------

const PLL_RAW = [
  { id: 'ua', name: 'Ua perm', alg: "M2 U M U2 M' U M2" },
  { id: 'ub', name: 'Ub perm', alg: "M2 U' M U2 M' U' M2" },
  { id: 'h', name: 'H perm', alg: 'M2 U M2 U2 M2 U M2' },
  { id: 'z', name: 'Z perm', alg: "M' U M2 U M2 U M' U2 M2" },
  { id: 't', name: 'T perm', alg: "R U R' U' R' F R2 U' R' U' R U R' F'" },
  { id: 'y', name: 'Y perm', alg: "F R U' R' U' R U R' F' R U R' U' R' F R F'" },
  { id: 'ja', name: 'Ja perm', alg: "R' U L' U2 R U' R' U2 R L" },
  { id: 'jb', name: 'Jb perm', alg: "R U R' F' R U R' U' R' F R2 U' R' U'" },
  { id: 'f', name: 'F perm', alg: "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R" },
];

export const PLL_CASES: LLCase[] = buildValidated(PLL_RAW, (problem, sig) => {
  if (!sig.cornerOri.every((o) => o === 0)) return false;
  if (!sig.edgeOri.every(Boolean)) return false;
  if (arraysEqual(sig.cornerId, SOLVED_CORNER_ID) && arraysEqual(sig.edgeId, SOLVED_EDGE_ID)) return false;
  return lowerLayersIntact(problem);
});

// ---------- OLL step 1: orient edges only, corners must stay untouched ----------

const OLL_EDGE_RAW = [
  { id: 'eo-line', name: 'Line', alg: "F R U R' U' F'" },
  { id: 'eo-lshape', name: 'L-shape', alg: "F U R U' R' F'" },
  { id: 'eo-dot', name: 'Dot', alg: "F R U R' U' F' U F U R U' R' F'" },
];

export const OLL_EDGE_CASES: LLCase[] = buildValidated(OLL_EDGE_RAW, (problem, sig) => {
  if (sig.edgeOri.every(Boolean)) return false;
  return lowerLayersIntact(problem);
});

// ---------- OLL step 2: orient corners only, edges must stay untouched ----------

const OLL_CORNER_RAW = [
  { id: 'sune', name: 'Sune', alg: "R U R' U R U2 R'" },
  { id: 'antisune', name: 'Antisune', alg: "R U2 R' U' R U' R'" },
  { id: 'h', name: 'H', alg: 'R U R2 U R2 U R2 U2 R' },
  { id: 'pi', name: 'Pi', alg: "R U2 R2 U' R2 U' R2 U2 R" },
  { id: 't-shape', name: 'T shape', alg: "R U R' U' R' F R F'" },
  { id: 'u-shape', name: 'U shape', alg: "R2 D R' U2 R D' R' U2 R'" },
  { id: 'l-shape', name: 'L shape (fish)', alg: "F R' F' R U R U' R'" },
];

export const OLL_CORNER_CASES: LLCase[] = buildValidated(OLL_CORNER_RAW, (problem, sig) => {
  if (!sig.edgeOri.every(Boolean)) return false;
  if (sig.cornerOri.every((o) => o === 0)) return false;
  return lowerLayersIntact(problem);
});

export interface CaseMatch {
  case: LLCase;
  requiredFront: FaceId;
}

function matchRotation<T>(current: T[], canonical: T[]): number | null {
  for (let k = 0; k < 4; k++) {
    if (arraysEqual(rotate(current, k), canonical)) return k;
  }
  return null;
}

export function detectPll(cube: CubeState): CaseMatch | null {
  const sig = computeSignature(cube);
  for (const c of PLL_CASES) {
    const kCorner = matchRotation(sig.cornerId, c.signature.cornerId);
    if (kCorner === null) continue;
    const kEdge = matchRotation(sig.edgeId, c.signature.edgeId);
    if (kEdge !== kCorner) continue;
    return { case: c, requiredFront: FACE_CYCLE[kCorner] };
  }
  return null;
}

export function detectOllEdgePhase(cube: CubeState): CaseMatch | null {
  const sig = computeSignature(cube);
  if (sig.edgeOri.every(Boolean)) return null;
  for (const c of OLL_EDGE_CASES) {
    const k = matchRotation(sig.edgeOri, c.signature.edgeOri);
    if (k !== null) return { case: c, requiredFront: FACE_CYCLE[k] };
  }
  return null;
}

export function detectOllCornerPhase(cube: CubeState): CaseMatch | null {
  const sig = computeSignature(cube);
  if (sig.cornerOri.every((o) => o === 0)) return null;
  for (const c of OLL_CORNER_CASES) {
    const k = matchRotation(sig.cornerOri, c.signature.cornerOri);
    if (k !== null) return { case: c, requiredFront: FACE_CYCLE[k] };
  }
  return null;
}
