import type { FaceId, Move } from './types';
import { CubeState, WORLD_FACE_DIR } from './state';
import { detectOllCornerPhase, detectOllEdgePhase, detectPll } from './llAnalysis';

export type Stage =
  | 'centers'
  | 'edges'
  | 'cross'
  | 'first-layer'
  | 'f2l'
  | 'oll'
  | 'pll'
  | 'solved';

export interface StageInfo {
  stage: Stage;
  title: string;
  hint: string;
}

const STAGE_INFO: Record<Stage, { title: string; hint: string }> = {
  centers: {
    title: 'Build the centers',
    hint: 'Pick one face and turn its outer layers to gather 4+ same-color center pieces there, then repeat for the other 5 colors - work on opposite faces (like white then yellow) so you don’t undo progress on the one you just finished.',
  },
  edges: {
    title: 'Pair the edges',
    hint: 'Find two edge pieces that share a pair of colors and bring them face to face (usually on the front or back layer), then turn a side layer to slide them together into one matched block - repeat for all 12 edges.',
  },
  cross: {
    title: 'Solve the cross',
    hint: 'Do this on top, not the bottom - it’s easier to see and reach. For each of the 4 edge pieces matching the top color: bring it to the top layer, then turn U to line its OTHER color up with that color’s center before turning it into the cross. Once all 4 are placed and lined up, tap ⇅ Flip to send the cross to the bottom.',
  },
  'first-layer': {
    title: 'Finish the first layer',
    hint: 'Still working on top: for each corner piece belonging up there, position it directly above its empty slot (use U to line it up under the two matching side colors), then repeat R U R’ U’ (or the mirrored L’ U’ L U on the other side) until it pops into the slot facing the right way. Do all 4, then tap ⇅ Flip.',
  },
  f2l: {
    title: 'Finish the second layer (F2L)',
    hint: 'F2L = "First Two Layers." For each remaining edge, find its matching corner, bring both up to the top layer next to each other, then turn U to line the pair up over its empty middle-layer slot before repeating R U R’ U’ (or L’ U’ L U) to drop them in together, matched and correctly oriented.',
  },
  oll: {
    title: 'Orient the last layer (OLL)',
    hint: 'OLL = "Orient Last Layer." Get the top face to one solid color in two looks: first fix any misoriented edges (3 possible shapes - dot, L, or line), then fix any twisted corners (7 shapes). You don’t need to memorize these - pause for a few seconds and this app recognizes your exact shape and shows the precise algorithm, highlighting each move as you go. (Solved F2L on top and haven’t flipped? Tap ⇅ Flip first - exact algorithms only show once the last layer is on top.) Want to drill a shape ahead of time? Use "Practice a case" above.',
  },
  pll: {
    title: 'Permute the last layer (PLL)',
    hint: 'PLL = "Permute Last Layer." The top is one color, but pieces may be in the wrong spot. Pause for a moment and this app recognizes your exact case (one of 21 standard patterns) and shows the algorithm, highlighting each move as you go - or use "Practice a case" above to try any of them ahead of time.',
  },
  solved: {
    title: 'Solved!',
    hint: 'The cube is fully solved. Scramble it to practice again.',
  },
};

function faceGrid(cube: CubeState, face: FaceId) {
  const dir = WORLD_FACE_DIR[face];
  const all = cube.getAllStickers();
  return all.filter((s) => approxDir(s.worldDir, dir));
}

function approxDir(a: [number, number, number], b: [number, number, number]) {
  return Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01 && Math.abs(a[2] - b[2]) < 0.01;
}

const OTHER_AXES: Record<FaceId, [0 | 1 | 2, 0 | 1 | 2]> = {
  U: [0, 2], D: [0, 2],
  L: [1, 2], R: [1, 2],
  F: [0, 1], B: [0, 1],
};

function centersSolved(cube: CubeState): boolean {
  const max = (cube.n - 1) / 2;
  const faces: FaceId[] = ['U', 'D', 'L', 'R', 'F', 'B'];
  return faces.every((face) => {
    const grid = faceGrid(cube, face);
    const [a, b] = OTHER_AXES[face];
    const inner = grid.filter((s) => Math.abs(s.pos[a]) < max - 0.5 && Math.abs(s.pos[b]) < max - 0.5);
    if (inner.length === 0) return true;
    return inner.every((s) => s.color === inner[0].color);
  });
}

function edgesPaired(cube: CubeState): boolean {
  const max = (cube.n - 1) / 2;
  const faces: FaceId[] = ['U', 'D', 'L', 'R', 'F', 'B'];
  return faces.every((face) => {
    const grid = faceGrid(cube, face);
    const [a, b] = OTHER_AXES[face];
    // 4 edge lines: a = +max (b varies, not extreme), a = -max, b = +max, b = -max
    const lines = [
      grid.filter((s) => s.pos[a] > max - 0.5 && Math.abs(s.pos[b]) < max - 0.5),
      grid.filter((s) => s.pos[a] < -max + 0.5 && Math.abs(s.pos[b]) < max - 0.5),
      grid.filter((s) => s.pos[b] > max - 0.5 && Math.abs(s.pos[a]) < max - 0.5),
      grid.filter((s) => s.pos[b] < -max + 0.5 && Math.abs(s.pos[a]) < max - 0.5),
    ];
    return lines.every((line) => line.length === 0 || line.every((s) => s.color === line[0].color));
  });
}

// The color a face's center currently shows - not necessarily that face's
// "original" color, since a whole-cube flip can move any color to any face.
function faceCenterColor(cube: CubeState, face: FaceId): string | undefined {
  const max = (cube.n - 1) / 2;
  const grid = faceGrid(cube, face);
  const [a, b] = OTHER_AXES[face];
  return grid.find((s) => Math.abs(s.pos[a]) < max - 0.5 && Math.abs(s.pos[b]) < max - 0.5)?.color;
}

const OPPOSITE_OF: Record<FaceId, FaceId> = { U: 'D', D: 'U', L: 'R', R: 'L', F: 'B', B: 'F' };

// "Below" is relative to whichever face is currently being treated as the
// first-layer base (bottomFace) - U just as validly as D, since nothing about
// solving requires yellow-on-bottom specifically. signedDepth transforms y so
// that bottomFace's own layer is always at +max and the opposite layer at -max,
// regardless of whether bottomFace is U or D.
function signedDepth(yPos: number, bottomFace: FaceId): number {
  return yPos * WORLD_FACE_DIR[bottomFace][1];
}

function faceMatchesBelow(cube: CubeState, face: FaceId, bottomFace: FaceId, includeMiddle: boolean): boolean {
  const max = (cube.n - 1) / 2;
  const threshold = includeMiddle ? -max + 0.5 : max - 0.5;
  const grid = faceGrid(cube, face);
  const relevant = grid.filter((s) => signedDepth(s.pos[1], bottomFace) > threshold);
  if (relevant.length === 0) return true;
  return relevant.every((s) => s.color === relevant[0].color);
}

interface BottomProgress {
  crossDone: boolean;
  firstLayerDone: boolean;
  f2lDone: boolean;
}

function evaluateFromBottom(cube: CubeState, bottomFace: FaceId): BottomProgress {
  const crossDone = cube.isFaceSolved(bottomFace) && crossFullyDone(cube, bottomFace);
  const firstLayerDone =
    crossDone && (['L', 'R', 'F', 'B'] as FaceId[]).every((f) => faceMatchesBelow(cube, f, bottomFace, false));
  const f2lDone =
    firstLayerDone && (['L', 'R', 'F', 'B'] as FaceId[]).every((f) => faceMatchesBelow(cube, f, bottomFace, true));
  return { crossDone, firstLayerDone, f2lDone };
}

function progressRank(p: BottomProgress): number {
  if (p.f2lDone) return 3;
  if (p.firstLayerDone) return 2;
  if (p.crossDone) return 1;
  return 0;
}

// The first two layers can be solved on either U or D - whichever the solver
// finds easier - so evaluate progress from both and go with whichever is
// further along, rather than assuming D is always "the" bottom. Returns which
// face is acting as bottom (first two layers) right now.
function determineBottomFace(cube: CubeState): FaceId {
  const onD = evaluateFromBottom(cube, 'D');
  const onU = evaluateFromBottom(cube, 'U');
  return progressRank(onU) > progressRank(onD) ? 'U' : 'D';
}

export function detectStage(cube: CubeState): StageInfo {
  if (cube.n > 3 && !centersSolved(cube)) {
    return { stage: 'centers', ...STAGE_INFO.centers };
  }
  if (cube.n > 3 && !edgesPaired(cube)) {
    return { stage: 'edges', ...STAGE_INFO.edges };
  }

  const bottomFace = determineBottomFace(cube);
  const progress = evaluateFromBottom(cube, bottomFace);
  const topFace = OPPOSITE_OF[bottomFace];

  if (!progress.crossDone) {
    return { stage: 'cross', ...STAGE_INFO.cross };
  }
  if (!progress.firstLayerDone) {
    return { stage: 'first-layer', ...STAGE_INFO['first-layer'] };
  }
  if (!progress.f2lDone) {
    return { stage: 'f2l', ...STAGE_INFO.f2l };
  }
  if (!cube.isFaceSolved(topFace)) {
    return { stage: 'oll', ...STAGE_INFO.oll };
  }
  if (!cube.isSolved()) {
    return { stage: 'pll', ...STAGE_INFO.pll };
  }
  return { stage: 'solved', ...STAGE_INFO.solved };
}

function crossFullyDone(cube: CubeState, bottomFace: FaceId): boolean {
  const max = (cube.n - 1) / 2;
  const all = cube.getAllStickers();
  const bDir = WORLD_FACE_DIR[bottomFace];
  const bCenterColor = faceCenterColor(cube, bottomFace);
  if (bCenterColor === undefined) return false;
  const edgeStickersOnBottom = all.filter(
    (s) => approxDir(s.worldDir, bDir) && (Math.abs(s.pos[0]) > max - 0.5) !== (Math.abs(s.pos[2]) > max - 0.5)
  );
  if (!edgeStickersOnBottom.every((s) => s.color === bCenterColor)) return false;
  const sideFaces: FaceId[] = ['L', 'R', 'F', 'B'];
  return sideFaces.every((face) => {
    const grid = faceGrid(cube, face);
    const [a, b] = OTHER_AXES[face];
    const centerColor = faceCenterColor(cube, face);
    const bottomEdge = grid.filter(
      (s) => signedDepth(s.pos[1], bottomFace) > max - 0.5 && (Math.abs(s.pos[a]) < max - 0.5) !== (Math.abs(s.pos[b]) < max - 0.5)
    );
    return centerColor !== undefined && bottomEdge.every((s) => s.color === centerColor);
  });
}

export interface ExactHint {
  category: 'OLL edges' | 'OLL corners' | 'PLL';
  caseName: string;
  moves: Move[];
  requiredFront: FaceId;
}

// Exact algorithm lookup - only meaningful on a 3x3 during OLL/PLL, where the
// remaining state is one of a known finite set of cases. Returns null when the
// size doesn't support case recognition, or when the current pattern doesn't
// match any of the algorithms we have on file (falls back to the plain hint text).
export function getExactHint(cube: CubeState, n: number, stage: Stage): ExactHint | null {
  if (n !== 3) return null;
  // Stored algorithms are only valid to execute when U is genuinely the last
  // layer - if the solver worked from the top down and hasn't physically
  // flipped yet, the case can still be *recognized* relative to D, but the
  // algorithm's moves can't be naively translated (a flip swaps more than just
  // U/D, and the camera has no notion of "upside-down"). So only offer the
  // exact algorithm once U is actually the layer left to fix; otherwise fall
  // back to the plain hint text, which reminds the solver to flip first.
  if (determineBottomFace(cube) !== 'D') return null;
  if (stage === 'oll') {
    const edgePhase = detectOllEdgePhase(cube);
    if (edgePhase) {
      return { category: 'OLL edges', caseName: edgePhase.case.name, moves: edgePhase.case.moves, requiredFront: edgePhase.requiredFront };
    }
    const cornerPhase = detectOllCornerPhase(cube);
    if (cornerPhase) {
      return { category: 'OLL corners', caseName: cornerPhase.case.name, moves: cornerPhase.case.moves, requiredFront: cornerPhase.requiredFront };
    }
    return null;
  }
  if (stage === 'pll') {
    const p = detectPll(cube);
    if (p) {
      return { category: 'PLL', caseName: p.case.name, moves: p.case.moves, requiredFront: p.requiredFront };
    }
    return null;
  }
  return null;
}
