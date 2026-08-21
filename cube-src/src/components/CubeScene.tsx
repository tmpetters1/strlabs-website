import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { CubeState } from '../cube/state';
import { selectMoveCubies } from '../cube/engine';
import type { FaceId, Move } from '../cube/types';
import { FACE_AXIS, FACE_COLOR, FACE_SIGN } from '../cube/types';

const STICKER_COLOR: Record<string, string> = FACE_COLOR;
const BODY_COLOR = '#131419';
const BLIND_STICKER_COLOR = '#3a3f4c';
const GAP = 0.07;
const CUBIE_SIZE = 1 - GAP;
const BODY_BEVEL = 0.09;
const STICKER_SIZE = CUBIE_SIZE * 0.8;
const STICKER_THICKNESS = 0.06;
const STICKER_BEVEL = 0.025;
const STICKER_OFFSET = CUBIE_SIZE / 2 + STICKER_THICKNESS / 2 - 0.01;

type LocalDirKey = 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-';
const LOCAL_ORDER: LocalDirKey[] = ['x+', 'x-', 'y+', 'y-', 'z+', 'z-'];

const LOCAL_DIR_VECTOR: Record<LocalDirKey, THREE.Vector3> = {
  'x+': new THREE.Vector3(1, 0, 0),
  'x-': new THREE.Vector3(-1, 0, 0),
  'y+': new THREE.Vector3(0, 1, 0),
  'y-': new THREE.Vector3(0, -1, 0),
  'z+': new THREE.Vector3(0, 0, 1),
  'z-': new THREE.Vector3(0, 0, -1),
};

const STICKER_QUATERNION: Record<LocalDirKey, THREE.Quaternion> = LOCAL_ORDER.reduce((acc, key) => {
  acc[key] = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), LOCAL_DIR_VECTOR[key]);
  return acc;
}, {} as Record<LocalDirKey, THREE.Quaternion>);

const bodyMaterial = new THREE.MeshStandardMaterial({ color: BODY_COLOR, roughness: 0.55, metalness: 0.1 });

function basisToQuaternion(basis: [[number, number, number], [number, number, number], [number, number, number]]) {
  const m = new THREE.Matrix4();
  m.set(
    basis[0][0], basis[1][0], basis[2][0], 0,
    basis[0][1], basis[1][1], basis[2][1], 0,
    basis[0][2], basis[1][2], basis[2][2], 0,
    0, 0, 0, 1
  );
  const q = new THREE.Quaternion();
  q.setFromRotationMatrix(m);
  return q;
}

function CubieMesh({ cubie, blindMode }: { cubie: CubeState['cubies'][number]; blindMode: boolean }) {
  const stickerKeys = useMemo(
    () => LOCAL_ORDER.filter((key) => cubie.stickers[key]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.position.set(cubie.pos[0], cubie.pos[1], cubie.pos[2]);
    groupRef.current.quaternion.copy(basisToQuaternion(cubie.basis));
  });

  return (
    <group ref={groupRef}>
      <RoundedBox
        args={[CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE]}
        radius={BODY_BEVEL}
        smoothness={3}
        material={bodyMaterial}
        castShadow
        receiveShadow
      />
      {stickerKeys.map((key) => {
        const color = cubie.stickers[key]!;
        const hex = blindMode ? BLIND_STICKER_COLOR : STICKER_COLOR[color];
        const pos = LOCAL_DIR_VECTOR[key].clone().multiplyScalar(STICKER_OFFSET);
        return (
          <RoundedBox
            key={key}
            args={[STICKER_SIZE, STICKER_SIZE, STICKER_THICKNESS]}
            radius={STICKER_BEVEL}
            smoothness={3}
            position={[pos.x, pos.y, pos.z]}
            quaternion={STICKER_QUATERNION[key]}
            castShadow
          >
            <meshStandardMaterial
              color={hex}
              roughness={blindMode ? 0.6 : 0.28}
              metalness={0.04}
            />
          </RoundedBox>
        );
      })}
    </group>
  );
}

const WORLD_FACE_DIR: Record<FaceId, THREE.Vector3> = {
  R: new THREE.Vector3(1, 0, 0),
  L: new THREE.Vector3(-1, 0, 0),
  U: new THREE.Vector3(0, 1, 0),
  D: new THREE.Vector3(0, -1, 0),
  F: new THREE.Vector3(0, 0, 1),
  B: new THREE.Vector3(0, 0, -1),
};

const OPPOSITE_FACE: Record<FaceId, FaceId> = { U: 'D', D: 'U', L: 'R', R: 'L', F: 'B', B: 'F' };

function nearestFace(dir: THREE.Vector3): FaceId {
  let best: FaceId = 'F';
  let bestDot = -Infinity;
  (Object.keys(WORLD_FACE_DIR) as FaceId[]).forEach((f) => {
    const d = dir.dot(WORLD_FACE_DIR[f]);
    if (d > bestDot) {
      bestDot = d;
      best = f;
    }
  });
  return best;
}

function FrontFaceHighlight({
  n,
  onFrontFaceChange,
  onOrientationChange,
}: {
  n: number;
  onFrontFaceChange: (f: FaceId) => void;
  onOrientationChange: (map: Record<FaceId, FaceId>) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const lastFace = useRef<FaceId | null>(null);
  const lastMapKey = useRef<string | null>(null);
  const half = n / 2 + 0.03;

  useFrame(() => {
    const camDir = camera.position.clone().normalize();
    const best = nearestFace(camDir);
    if (best !== lastFace.current) {
      lastFace.current = best;
      onFrontFaceChange(best);
    }

    // Map each visual (screen-relative) direction to the world face currently occupying it,
    // so the buttons/keyboard always turn what's visually R/L/U/D/F/B from the current view.
    const rightDir = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const upDir = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const mapF = best;
    const mapR = nearestFace(rightDir);
    const mapU = nearestFace(upDir);
    const mapKey = `${mapF}${mapR}${mapU}`;
    if (mapKey !== lastMapKey.current) {
      lastMapKey.current = mapKey;
      onOrientationChange({
        F: mapF,
        B: OPPOSITE_FACE[mapF],
        R: mapR,
        L: OPPOSITE_FACE[mapR],
        U: mapU,
        D: OPPOSITE_FACE[mapU],
      });
    }

    if (ref.current) {
      const dir = WORLD_FACE_DIR[best];
      ref.current.position.set(dir.x * half, dir.y * half, dir.z * half);
      ref.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    }
  });

  return (
    <group ref={ref}>
      <mesh>
        <ringGeometry args={[n * 0.68, n * 0.74, 4]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0.0} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.PlaneGeometry(n * 1.02, n * 1.02)]} />
        <lineBasicMaterial color="#7dd3fc" linewidth={2} />
      </lineSegments>
      <mesh>
        <planeGeometry args={[n * 1.02, n * 1.02]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0.06} depthWrite={false} />
      </mesh>
    </group>
  );
}

interface AnimState {
  move: Move;
  affectedIds: Set<number>;
  startTime: number;
  duration: number;
  fromAngle: number;
  toAngle: number;
  axis: THREE.Vector3;
}

export interface CubeSceneHandle {
  pushMove: (move: Move) => void;
  scramble: (moves: Move[]) => void;
  reset: () => void;
}

interface CubeSceneProps {
  n: number;
  blindMode: boolean;
  onStateChange: (state: CubeState) => void;
  onFrontFaceChange: (face: FaceId) => void;
  onOrientationChange: (map: Record<FaceId, FaceId>) => void;
  onAnimatingChange: (animating: boolean) => void;
  onMoveApplied: (move: Move) => void;
}

function RotatingRig({
  n,
  blindMode,
  cubeStateRef,
  queueRef,
  setVersion,
  onStateChange,
  onAnimatingChange,
  onMoveApplied,
}: {
  n: number;
  blindMode: boolean;
  cubeStateRef: React.MutableRefObject<CubeState>;
  queueRef: React.MutableRefObject<Move[]>;
  setVersion: (fn: (v: number) => number) => void;
  onStateChange: (state: CubeState) => void;
  onAnimatingChange: (animating: boolean) => void;
  onMoveApplied: (move: Move) => void;
}) {
  const animRef = useRef<AnimState | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const [animatingIds, setAnimatingIds] = useState<Set<number> | null>(null);

  useFrame(() => {
    if (!animRef.current && queueRef.current.length > 0) {
      const move = queueRef.current.shift()!;
      const cubies = cubeStateRef.current.cubies;
      const affected = selectMoveCubies(cubies, n, move);
      if (affected.length === 0) {
        return;
      }
      const axis = move.slice
        ? new THREE.Vector3(move.slice === 'M' ? 1 : 0, move.slice === 'E' ? 1 : 0, move.slice === 'S' ? 1 : 0)
        : new THREE.Vector3(
            FACE_AXIS[move.face] === 'x' ? 1 : 0,
            FACE_AXIS[move.face] === 'y' ? 1 : 0,
            FACE_AXIS[move.face] === 'z' ? 1 : 0
          );
      const sign = move.slice
        ? move.slice === 'M'
          ? -1
          : move.slice === 'E'
          ? -1
          : 1
        : FACE_SIGN[move.face];
      const dir = -sign; // clockwise-from-outside visual direction
      const totalAngle = dir * move.turns * (Math.PI / 2);
      animRef.current = {
        move,
        affectedIds: new Set(affected.map((c) => c.id)),
        startTime: performance.now(),
        duration: 220,
        fromAngle: 0,
        toAngle: totalAngle,
        axis,
      };
      onAnimatingChange(true);
      setAnimatingIds(new Set(affected.map((c) => c.id)));
    }

    if (animRef.current && groupRef.current) {
      const a = animRef.current;
      const t = Math.min(1, (performance.now() - a.startTime) / a.duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const angle = a.fromAngle + (a.toAngle - a.fromAngle) * eased;
      groupRef.current.setRotationFromAxisAngle(a.axis, angle);

      if (t >= 1) {
        cubeStateRef.current.applyMove(a.move);
        groupRef.current.setRotationFromAxisAngle(a.axis, 0);
        animRef.current = null;
        onAnimatingChange(false);
        onStateChange(cubeStateRef.current);
        onMoveApplied(a.move);
        setVersion((v) => v + 1);
        setAnimatingIds(null);
      }
    }
  });

  const state = cubeStateRef.current;
  const affectedSet = animatingIds;
  const staticCubies = affectedSet ? state.cubies.filter((c) => !affectedSet.has(c.id)) : state.cubies;
  const spinningCubies = affectedSet ? state.cubies.filter((c) => affectedSet.has(c.id)) : [];

  return (
    <>
      <group>
        {staticCubies.map((c) => (
          <CubieMesh key={c.id} cubie={c} blindMode={blindMode} />
        ))}
      </group>
      <group ref={groupRef}>
        {spinningCubies.map((c) => (
          <CubieMesh key={c.id} cubie={c} blindMode={blindMode} />
        ))}
      </group>
    </>
  );
}

const CubeScene = forwardRef<CubeSceneHandle, CubeSceneProps>(function CubeScene(
  { n, blindMode, onStateChange, onFrontFaceChange, onOrientationChange, onAnimatingChange, onMoveApplied },
  ref
) {
  const cubeStateRef = useRef(new CubeState(n));
  const queueRef = useRef<Move[]>([]);
  const [, setVersion] = useState(0);

  useImperativeHandle(ref, () => ({
    pushMove: (move: Move) => {
      queueRef.current.push(move);
    },
    scramble: (moves: Move[]) => {
      // Apply instantly, with no animation - a scramble isn't meant to be watched move-by-move.
      queueRef.current = [];
      for (const move of moves) {
        cubeStateRef.current.applyMove(move);
      }
      setVersion((v) => v + 1);
      onStateChange(cubeStateRef.current);
    },
    reset: () => {
      queueRef.current = [];
      cubeStateRef.current = new CubeState(n);
      setVersion((v) => v + 1);
      onStateChange(cubeStateRef.current);
    },
  }));

  return (
    <Canvas
      shadows
      camera={{ position: [n * 1.7, n * 1.5, n * 2.1], fov: 40 }}
      style={{ touchAction: 'none' }}
    >
      <color attach="background" args={['#101216']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 10, 8]} intensity={0.95} castShadow />
      <directionalLight position={[-6, -4, -8]} intensity={0.35} />
      <RotatingRig
        n={n}
        blindMode={blindMode}
        cubeStateRef={cubeStateRef}
        queueRef={queueRef}
        setVersion={setVersion}
        onStateChange={onStateChange}
        onAnimatingChange={onAnimatingChange}
        onMoveApplied={onMoveApplied}
      />
      <FrontFaceHighlight n={n} onFrontFaceChange={onFrontFaceChange} onOrientationChange={onOrientationChange} />
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={n * 1.6}
        maxDistance={n * 4}
        rotateSpeed={0.6}
      />
    </Canvas>
  );
});

export default CubeScene;
