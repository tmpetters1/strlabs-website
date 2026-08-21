import { PLL_CASES, OLL_EDGE_CASES, OLL_CORNER_CASES, type LLCase } from '../cube/llAnalysis';
import { moveToNotation } from '../cube/moves';

interface PracticePanelProps {
  onPick: (llCase: LLCase) => void;
  onClose: () => void;
}

function CaseGroup({ title, cases, onPick }: { title: string; cases: LLCase[]; onPick: (c: LLCase) => void }) {
  if (cases.length === 0) return null;
  return (
    <div className="practice-group">
      <h3>{title}</h3>
      <div className="practice-cases">
        {cases.map((c) => (
          <button key={c.id} className="practice-case" onClick={() => onPick(c)}>
            <span className="practice-case-name">{c.name}</span>
            <span className="practice-case-alg">{c.moves.map(moveToNotation).join(' ')}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function PracticePanel({ onPick, onClose }: PracticePanelProps) {
  return (
    <div className="bindings-overlay" onClick={onClose}>
      <div className="bindings-panel practice-panel" onClick={(e) => e.stopPropagation()}>
        <div className="bindings-header">
          <h2>Practice a case</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="bindings-note">
          Pick a case to jump straight to it (3x3 only) - the camera lines up and the algorithm
          shows immediately, ready to drill.
        </p>
        <div className="practice-scroll">
          <CaseGroup title="OLL - orient edges" cases={OLL_EDGE_CASES} onPick={onPick} />
          <CaseGroup title="OLL - orient corners" cases={OLL_CORNER_CASES} onPick={onPick} />
          <CaseGroup title="PLL" cases={PLL_CASES} onPick={onPick} />
        </div>
      </div>
    </div>
  );
}
