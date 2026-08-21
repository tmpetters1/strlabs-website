import { useCallback, useEffect, useRef, useState } from 'react';
import CubeScene, { type CubeSceneHandle } from './components/CubeScene';
import { LeftButtonPanel, RightButtonPanel } from './components/Buttons';
import type { FaceId, Move } from './cube/types';
import { CubeState } from './cube/state';
import { detectStage, type StageInfo } from './cube/stepDetector';
import { randomScramble } from './cube/scramble';
import { invertMove } from './cube/moves';
import { useKeyboardControls } from './hooks/useKeyboardControls';
import './App.css';

const SIZES = [3, 4, 5] as const;
const HINT_DELAY_MS = 10000;

function App() {
  const [n, setN] = useState<3 | 4 | 5>(3);
  const [sceneKey, setSceneKey] = useState(0);
  const sceneRef = useRef<CubeSceneHandle>(null);
  const [, setCubeState] = useState<CubeState>(() => new CubeState(3));
  const [frontFace, setFrontFace] = useState<FaceId>('F');
  const [animating, setAnimating] = useState(false);
  const [stage, setStage] = useState<StageInfo>(() => detectStage(new CubeState(3)));
  const [showHint, setShowHint] = useState(false);
  const [history, setHistory] = useState<Move[]>([]);
  const [blindMode, setBlindMode] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoingRef = useRef(false);

  const resetHintTimer = useCallback(() => {
    setShowHint(false);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setShowHint(true), HINT_DELAY_MS);
  }, []);

  useEffect(() => {
    resetHintTimer();
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, [resetHintTimer, sceneKey]);

  const handleStateChange = useCallback((state: CubeState) => {
    setCubeState(state.clone());
    setStage(detectStage(state));
    resetHintTimer();
  }, [resetHintTimer]);

  const handleMoveApplied = useCallback((move: Move) => {
    if (undoingRef.current) {
      undoingRef.current = false;
      setHistory((h) => h.slice(0, -1));
    } else {
      setHistory((h) => [...h, move]);
    }
  }, []);

  const handleMove = useCallback((move: Move) => {
    sceneRef.current?.pushMove(move);
    resetHintTimer();
  }, [resetHintTimer]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    undoingRef.current = true;
    sceneRef.current?.pushMove(invertMove(last));
    resetHintTimer();
  }, [history, resetHintTimer]);

  useKeyboardControls(n, handleMove, animating);

  const [isTouch] = useState(() => window.matchMedia('(hover: none) and (pointer: coarse)').matches);

  const handleSizeChange = (newN: 3 | 4 | 5) => {
    setN(newN);
    setSceneKey((k) => k + 1);
    const fresh = new CubeState(newN);
    setCubeState(fresh);
    setStage(detectStage(fresh));
    setHistory([]);
    undoingRef.current = false;
  };

  const handleScramble = () => {
    const moves = randomScramble(n);
    sceneRef.current?.scramble(moves);
    resetHintTimer();
  };

  const handleReset = () => {
    sceneRef.current?.reset();
    const fresh = new CubeState(n);
    setCubeState(fresh);
    setStage(detectStage(fresh));
    setHistory([]);
    undoingRef.current = false;
    resetHintTimer();
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" />
          <h1>Cube Coach</h1>
        </div>

        <div className="size-select" role="tablist" aria-label="Cube size">
          {SIZES.map((s) => (
            <button
              key={s}
              className={`size-btn ${s === n ? 'active' : ''}`}
              onClick={() => handleSizeChange(s)}
            >
              {s}×{s}
            </button>
          ))}
        </div>

        <div className="topbar-actions">
          <button
            className={`blind-toggle ${blindMode ? 'active' : ''}`}
            onClick={() => setBlindMode((b) => !b)}
            title="Hide sticker colors to practice algorithms blind"
          >
            <span className="blind-dot" />
            <span className="blind-label">Blind mode</span>
          </button>
          <button className="ghost-btn" onClick={handleUndo} disabled={animating || history.length === 0}>
            Undo
          </button>
          <button className="ghost-btn" onClick={handleScramble} disabled={animating}>Scramble</button>
          <button className="ghost-btn" onClick={handleReset} disabled={animating}>Reset</button>
        </div>
      </header>

      <div className="stage-bar">
        <span className="stage-pill">
          <span className="stage-dot" />
          {stage.title}
        </span>
        <span className="front-face-tag">Front <strong>{frontFace}</strong></span>
        {!isTouch && (
          <span className="kbd-hint">
            ↑↓←→ U/D/L/R &nbsp;·&nbsp; Space F &nbsp;·&nbsp; Alt B &nbsp;·&nbsp; Shift ' &nbsp;·&nbsp; Ctrl wide
          </span>
        )}
        <span className="move-count">{history.length} moves</span>
      </div>

      <main className="play-area">
        <LeftButtonPanel n={n} onMove={handleMove} disabled={animating} />

        <div className="scene-wrap">
          <CubeScene
            key={sceneKey}
            ref={sceneRef}
            n={n}
            blindMode={blindMode}
            onStateChange={handleStateChange}
            onFrontFaceChange={setFrontFace}
            onAnimatingChange={setAnimating}
            onMoveApplied={handleMoveApplied}
          />
          {showHint && stage.stage !== 'solved' && (
            <div className="hint-popover">
              <p>Want a hint?</p>
              <p className="hint-text">{stage.hint}</p>
              <button onClick={() => setShowHint(false)}>Got it</button>
            </div>
          )}
          {stage.stage === 'solved' && <div className="solved-banner">Solved 🎉</div>}
        </div>

        <RightButtonPanel n={n} onMove={handleMove} disabled={animating} />
      </main>
    </div>
  );
}

export default App;
