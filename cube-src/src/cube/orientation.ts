import type { FaceId } from './types';

// Consecutive 90-degree (around Y, viewed from above) steps: F -> R -> B -> L -> F.
// Shared between camera-orientation code (CubeScene) and last-layer case
// recognition (llAnalysis) so both agree on what "rotate one step" means.
export const FACE_CYCLE: FaceId[] = ['F', 'R', 'B', 'L'];

export const OPPOSITE_FACE: Record<FaceId, FaceId> = { U: 'D', D: 'U', L: 'R', R: 'L', F: 'B', B: 'F' };
