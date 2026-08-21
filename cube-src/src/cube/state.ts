import type { Cubie, FaceId, Move } from './types';
import { FACE_AXIS, FACE_COLOR, FACE_SIGN } from './types';
import { applyMoveToCubies, createCubies } from './engine';

type Vec3 = [number, number, number];
type LocalDirKey = 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-';

const LOCAL_DIRS: { key: LocalDirKey; axisIndex: 0 | 1 | 2; sign: 1 | -1 }[] = [
  { key: 'x+', axisIndex: 0, sign: 1 },
  { key: 'x-', axisIndex: 0, sign: -1 },
  { key: 'y+', axisIndex: 1, sign: 1 },
  { key: 'y-', axisIndex: 1, sign: -1 },
  { key: 'z+', axisIndex: 2, sign: 1 },
  { key: 'z-', axisIndex: 2, sign: -1 },
];

const WORLD_FACE_DIR: Record<FaceId, Vec3> = {
  R: [1, 0, 0], L: [-1, 0, 0],
  U: [0, 1, 0], D: [0, -1, 0],
  F: [0, 0, 1], B: [0, 0, -1],
};

export interface StickeredCubie extends Cubie {
  stickers: Partial<Record<LocalDirKey, FaceId>>;
}

export class CubeState {
  n: number;
  cubies: StickeredCubie[];

  constructor(n: number) {
    this.n = n;
    const base = createCubies(n);
    const maxCoord = (n - 1) / 2;
    this.cubies = base.map((c) => {
      const stickers: Partial<Record<LocalDirKey, FaceId>> = {};
      if (c.pos[0] === maxCoord) stickers['x+'] = 'R';
      if (c.pos[0] === -maxCoord) stickers['x-'] = 'L';
      if (c.pos[1] === maxCoord) stickers['y+'] = 'U';
      if (c.pos[1] === -maxCoord) stickers['y-'] = 'D';
      if (c.pos[2] === maxCoord) stickers['z+'] = 'F';
      if (c.pos[2] === -maxCoord) stickers['z-'] = 'B';
      return { ...c, stickers };
    });
  }

  clone(): CubeState {
    const copy = new CubeState(this.n);
    copy.cubies = this.cubies.map((c) => ({
      ...c,
      pos: [...c.pos] as Vec3,
      basis: [[...c.basis[0]], [...c.basis[1]], [...c.basis[2]]] as Cubie['basis'],
      stickers: { ...c.stickers },
    }));
    return copy;
  }

  applyMove(move: Move) {
    const rotated = applyMoveToCubies(this.cubies, this.n, move);
    this.cubies = rotated.map((c, i) => ({ ...c, stickers: this.cubies[i].stickers }));
  }

  isSolved(): boolean {
    return (Object.keys(FACE_COLOR) as FaceId[]).every((f) => this.isFaceSolved(f));
  }

  isFaceSolved(face: FaceId): boolean {
    const colors = this.getFaceStickerColors(face);
    return colors.every((c) => c === colors[0]);
  }

  // Returns the color currently showing on the given cubie for a given world direction,
  // or undefined if that cubie has no sticker facing that way.
  private stickerColorForWorldDir(cubie: StickeredCubie, worldDir: Vec3): FaceId | undefined {
    for (const { key, axisIndex, sign } of LOCAL_DIRS) {
      const col = cubie.basis[axisIndex];
      const v: Vec3 = [col[0] * sign, col[1] * sign, col[2] * sign];
      if (approxEqual(v, worldDir)) {
        return cubie.stickers[key];
      }
    }
    return undefined;
  }

  getFaceStickerColors(face: FaceId): FaceId[] {
    const axis = FACE_AXIS[face];
    const sign = FACE_SIGN[face];
    const maxCoord = (this.n - 1) / 2;
    const dir = WORLD_FACE_DIR[face];
    const axisIdx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    const relevant = this.cubies.filter((c) => c.pos[axisIdx] * sign > maxCoord - 0.6);
    const colors: FaceId[] = [];
    for (const c of relevant) {
      const color = this.stickerColorForWorldDir(c, dir);
      if (color) colors.push(color);
    }
    return colors;
  }

  // For every visible sticker in the current state, return its render info.
  getAllStickers(): { cubieId: number; pos: Vec3; localDir: LocalDirKey; worldDir: Vec3; color: FaceId }[] {
    const out: { cubieId: number; pos: Vec3; localDir: LocalDirKey; worldDir: Vec3; color: FaceId }[] = [];
    for (const c of this.cubies) {
      for (const { key, axisIndex, sign } of LOCAL_DIRS) {
        const color = c.stickers[key];
        if (!color) continue;
        const col = c.basis[axisIndex];
        const worldDir: Vec3 = [col[0] * sign, col[1] * sign, col[2] * sign];
        out.push({ cubieId: c.id, pos: c.pos, localDir: key, worldDir, color });
      }
    }
    return out;
  }
}

function approxEqual(a: Vec3, b: Vec3): boolean {
  return Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01 && Math.abs(a[2] - b[2]) < 0.01;
}

export { WORLD_FACE_DIR };
