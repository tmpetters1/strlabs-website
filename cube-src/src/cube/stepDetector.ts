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
    hint: 'Group each color into a solid center block on its own face before anything else.',
  },
  edges: {
    title: 'Pair the edges',
    hint: 'Match up the edge pieces that share a color so each edge behaves like a single 3x3 edge.',
  },
  cross: {
    title: 'Solve the cross',
    hint: 'Get the bottom color cross formed, matching the side colors to their centers.',
  },
  'first-layer': {
    title: 'Finish the first layer',
    hint: 'Insert the bottom corners so the whole bottom face and first layer sides are done.',
  },
  f2l: {
    title: 'Finish the second layer (F2L)',
    hint: 'F2L = "First Two Layers." Pair and insert the middle-layer edges into their slots next to the corners.',
  },
  oll: {
    title: 'Orient the last layer (OLL)',
    hint: 'OLL = "Orient Last Layer." Get the top face to be a single solid color, ignoring the side stickers for now.',
  },
  pll: {
    title: 'Permute the last layer (PLL)',
    hint: 'PLL = "Permute Last Layer." The top face is oriented — now cycle the last layer pieces into their correct spots.',
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

function faceMatchesBelow(cube: CubeState, face: FaceId, yThresholdExclusive: number): boolean {
  const grid = faceGrid(cube, face);
  const relevant = grid.filter((s) => s.pos[1] < yThresholdExclusive);
  if (relevant.length === 0) return true;
  return relevant.every((s) => s.color === relevant[0].color);
}

export function detectStage(cube: CubeState): StageInfo {
  const max = (cube.n - 1) / 2;

  if (cube.n > 3 && !centersSolved(cube)) {
    return { stage: 'centers', ...STAGE_INFO.centers };
  }
  if (cube.n > 3 && !edgesPaired(cube)) {
    return { stage: 'edges', ...STAGE_INFO.edges };
  }
  if (!cube.isFaceSolved('D') || !crossFullyDone(cube)) {
    return { stage: 'cross', ...STAGE_INFO.cross };
  }
  const firstLayerDone =
    cube.isFaceSolved('D') && (['L', 'R', 'F', 'B'] as FaceId[]).every((f) => faceMatchesBelow(cube, f, -max + 0.5));
  if (!firstLayerDone) {
    return { stage: 'first-layer', ...STAGE_INFO['first-layer'] };
  }
  const f2lDone = (['L', 'R', 'F', 'B'] as FaceId[]).every((f) => faceMatchesBelow(cube, f, max - 0.5));
  if (!f2lDone) {
    return { stage: 'f2l', ...STAGE_INFO.f2l };
  }
  if (!cube.isFaceSolved('U')) {
    return { stage: 'oll', ...STAGE_INFO.oll };
  }
  if (!cube.isSolved()) {
    return { stage: 'pll', ...STAGE_INFO.pll };
  }
  return { stage: 'solved', ...STAGE_INFO.solved };
}

function crossFullyDone(cube: CubeState): boolean {
  const max = (cube.n - 1) / 2;
  const all = cube.getAllStickers();
  const dDir = WORLD_FACE_DIR['D'];
  const dCenterColor = faceCenterColor(cube, 'D');
  if (dCenterColor === undefined) return false;
  const edgeStickersOnD = all.filter(
    (s) => approxDir(s.worldDir, dDir) && (Math.abs(s.pos[0]) > max - 0.5) !== (Math.abs(s.pos[2]) > max - 0.5)
  );
  if (!edgeStickersOnD.every((s) => s.color === dCenterColor)) return false;
  const sideFaces: FaceId[] = ['L', 'R', 'F', 'B'];
  return sideFaces.every((face) => {
    const grid = faceGrid(cube, face);
    const [a, b] = OTHER_AXES[face];
    const centerColor = faceCenterColor(cube, face);
    const bottomEdge = grid.filter(
      (s) => s.pos[1] < -max + 0.5 && (Math.abs(s.pos[a]) < max - 0.5) !== (Math.abs(s.pos[b]) < max - 0.5)
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
