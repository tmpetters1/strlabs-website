import type { FaceId, Move } from '../cube/types';
import { FACE_COLOR } from '../cube/types';

interface FaceButtonProps {
  face: FaceId;
  prime: boolean;
  wide: boolean;
  onMove: (move: Move) => void;
  disabled: boolean;
}

function FaceButton({ face, prime, wide, onMove, disabled }: FaceButtonProps) {
  const handleClick = () => {
    onMove({
      face,
      depth: wide ? 2 : 1,
      turns: prime ? 3 : 1,
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
  const handleClick = () => {
    onMove({
      face: 'U',
      depth: 1,
      slice,
      turns: prime ? 3 : 1,
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

// Opposite-face pairs, one pair per row, so both faces of an axis sit side by side.
const FACE_ROWS: [FaceId, FaceId][] = [
  ['U', 'D'],
  ['L', 'R'],
  ['F', 'B'],
];

export function LeftButtonPanel({ n, onMove, disabled }: ButtonPanelProps) {
  const hasWide = n > 3;
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
    </div>
  );
}

export function RightButtonPanel({ n, onMove, disabled }: ButtonPanelProps) {
  const hasWide = n > 3;
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
    </div>
  );
}

// M/E/S slices are used far less often than face turns, so they get one shared
// strip at the bottom of the screen instead of taking up room in both side panels.
export function SliceBar({ n, onMove, disabled }: ButtonPanelProps) {
  const hasSlice = n % 2 === 1;
  if (!hasSlice) return null;
  const slices: ('M' | 'E' | 'S')[] = ['M', 'E', 'S'];
  return (
    <div className="slice-bar">
      {slices.map((slice) => (
        <div key={slice} className="slice-pair">
          <SliceButton slice={slice} prime onMove={onMove} disabled={disabled} />
          <SliceButton slice={slice} prime={false} onMove={onMove} disabled={disabled} />
        </div>
      ))}
    </div>
  );
}
