import { useRef } from 'react';
import type { FaceId, Move } from '../cube/types';
import { FACE_COLOR } from '../cube/types';

const DOUBLE_TAP_MS = 260;

interface FaceButtonProps {
  face: FaceId;
  prime: boolean;
  wide: boolean;
  onMove: (move: Move) => void;
  disabled: boolean;
}

function FaceButton({ face, prime, wide, onMove, disabled }: FaceButtonProps) {
  const lastTap = useRef(0);

  const handleClick = () => {
    const now = performance.now();
    const isDouble = now - lastTap.current < DOUBLE_TAP_MS;
    lastTap.current = isDouble ? 0 : now;
    onMove({
      face,
      depth: wide ? 2 : 1,
      turns: isDouble ? 2 : prime ? 3 : 1,
    });
  };

  const label = `${face}${wide ? 'w' : ''}${prime ? "'" : ''}`;

  return (
    <button
      className={`face-btn ${wide ? 'wide-btn' : ''}`}
      style={{ ['--face-color' as string]: FACE_COLOR[face] }}
      onClick={handleClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

interface SliceButtonProps {
  slice: 'M' | 'E' | 'S';
  prime: boolean;
  onMove: (move: Move) => void;
  disabled: boolean;
}

function SliceButton({ slice, prime, onMove, disabled }: SliceButtonProps) {
  const lastTap = useRef(0);
  const handleClick = () => {
    const now = performance.now();
    const isDouble = now - lastTap.current < DOUBLE_TAP_MS;
    lastTap.current = isDouble ? 0 : now;
    onMove({
      face: 'U',
      depth: 1,
      slice,
      turns: isDouble ? 2 : prime ? 3 : 1,
    });
  };
  const label = `${slice}${prime ? "'" : ''}`;
  return (
    <button className="face-btn slice-btn" onClick={handleClick} disabled={disabled}>
      {label}
    </button>
  );
}

interface ButtonPanelProps {
  n: number;
  onMove: (move: Move) => void;
  disabled: boolean;
}

function WideSlot({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div className={`btn-group wide-group face-grid ${visible ? '' : 'slot-hidden'}`} aria-hidden={!visible}>
      {children}
    </div>
  );
}

function SliceSlot({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div className={`btn-group slice-group ${visible ? '' : 'slot-hidden'}`} aria-hidden={!visible}>
      {children}
    </div>
  );
}

// Opposite-face pairs, one pair per row, so both faces of an axis sit side by side.
const FACE_ROWS: [FaceId, FaceId][] = [
  ['U', 'D'],
  ['L', 'R'],
  ['F', 'B'],
];

export function LeftButtonPanel({ n, onMove, disabled }: ButtonPanelProps) {
  const hasWide = n > 3;
  const hasSlice = n % 2 === 1;
  return (
    <div className="btn-panel btn-panel-left">
      <WideSlot visible={hasWide}>
        {FACE_ROWS.flat().map((face) => (
          <FaceButton key={face} face={face} prime wide onMove={onMove} disabled={disabled || !hasWide} />
        ))}
      </WideSlot>
      <div className="btn-group standard-group face-grid">
        {FACE_ROWS.flat().map((face) => (
          <FaceButton key={face} face={face} prime wide={false} onMove={onMove} disabled={disabled} />
        ))}
      </div>
      <SliceSlot visible={hasSlice}>
        <SliceButton slice="M" prime onMove={onMove} disabled={disabled || !hasSlice} />
        <SliceButton slice="E" prime onMove={onMove} disabled={disabled || !hasSlice} />
        <SliceButton slice="S" prime onMove={onMove} disabled={disabled || !hasSlice} />
      </SliceSlot>
    </div>
  );
}

export function RightButtonPanel({ n, onMove, disabled }: ButtonPanelProps) {
  const hasWide = n > 3;
  const hasSlice = n % 2 === 1;
  return (
    <div className="btn-panel btn-panel-right">
      <WideSlot visible={hasWide}>
        {FACE_ROWS.flat().map((face) => (
          <FaceButton key={face} face={face} prime={false} wide onMove={onMove} disabled={disabled || !hasWide} />
        ))}
      </WideSlot>
      <div className="btn-group standard-group face-grid">
        {FACE_ROWS.flat().map((face) => (
          <FaceButton key={face} face={face} prime={false} wide={false} onMove={onMove} disabled={disabled} />
        ))}
      </div>
      <SliceSlot visible={hasSlice}>
        <SliceButton slice="M" prime={false} onMove={onMove} disabled={disabled || !hasSlice} />
        <SliceButton slice="E" prime={false} onMove={onMove} disabled={disabled || !hasSlice} />
        <SliceButton slice="S" prime={false} onMove={onMove} disabled={disabled || !hasSlice} />
      </SliceSlot>
    </div>
  );
}
