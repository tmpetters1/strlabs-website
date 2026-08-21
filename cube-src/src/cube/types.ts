export type Axis = 'x' | 'y' | 'z';

export type FaceId = 'U' | 'D' | 'L' | 'R' | 'F' | 'B';

export interface Cubie {
  id: number;
  // Position in cube-space, integer coords centered at 0 (e.g. for 3x3: -1,0,1)
  pos: [number, number, number];
  // Orientation as a 3x3 rotation matrix stored as three basis vectors (columns),
  // starting as identity. Each column is one of +-x/+-y/+-z unit vectors.
  // basis[i] tells where the cubie's local axis i currently points in world space.
  basis: [[number, number, number], [number, number, number], [number, number, number]];
}

export interface Move {
  // Which face-layer(s) this move turns
  face: FaceId;
  // How many layers deep from that face (1 = outer layer only, 2 = also next layer for wide moves)
  depth: number;
  // Slice move instead of face move (M, E, S) - mutually exclusive with `face` semantics but reuses axis
  slice?: 'M' | 'E' | 'S';
  // Number of quarter turns clockwise (looking at the face from outside), 1..3
  turns: 1 | 2 | 3;
}

export const FACE_AXIS: Record<FaceId, Axis> = {
  R: 'x', L: 'x',
  U: 'y', D: 'y',
  F: 'z', B: 'z',
};

export const FACE_SIGN: Record<FaceId, 1 | -1> = {
  R: 1, L: -1,
  U: 1, D: -1,
  F: 1, B: -1,
};

export const FACE_COLOR: Record<FaceId, string> = {
  U: '#ffffff',
  D: '#ffd500',
  L: '#ff8c00',
  R: '#d10000',
  F: '#009e3d',
  B: '#0051d1',
};
