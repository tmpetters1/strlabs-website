import { useCallback, useEffect, useRef, useState } from 'react';
import CubeScene, { type CubeSceneHandle } from './components/CubeScene';
import { LeftButtonPanel, RightButtonPanel, SliceBar } from './components/Buttons';
import type { FaceId, Move } from './cube/types';
import { CubeState } from './cube/state';
import { detectStage, getExactHint, type ExactHint, type StageInfo } from './cube/stepDetector';
import { invertMove, moveToNotation } from './cube/moves';
import { randomScramble } from './cube/scramble';
import { useKeyboardControls } from './hooks/useKeyboardControls';
import { useKeyBindings } from './hooks/useKeyBindings';
import { BindingsPanel } from './components/BindingsPanel';
import { PracticePanel } from './components/PracticePanel';
import type { LLCase } from './cube/llAnalysis';
import './App.css';

const SIZES = [3, 4, 5] as const;
const HINT_DELAY_MS = 10000;
const IDENTITY_ORIENTATION: Record<FaceId, FaceId> = { U: 'U', D: 'D', L: 'L', R: 'R', F: 'F', B: 'B' };

function App() {
  const [n, setN] = useState<3 | 4 | 5>(3);
  const [sceneKey, setSceneKey] = useState(0);
  const sceneRef = useRef<CubeSceneHandle>(null);
  const [, setCubeState] = useState<CubeState>(() => new CubeState(3));
  const orientationRef = useRef<Record<FaceId, FaceId>>({ ...IDENTITY_ORIENTATION });
  const inverseOrientationRef = useRef<Record<FaceId, FaceId>>({ ...IDENTITY_ORIENTATION });
  const [stage, setStage] = useState<StageInfo>(() => detectStage(new CubeState(3)));
  const [showHint, setShowHint] = useState(false);
  const [history, setHistory] = useState<Move[]>([]);
  const [redoStack, setRedoStack] = useState<Move[]>([]);
  const [blindMode, setBlindMode] = useState(false);
  const [exactHint, setExactHint] = useState<ExactHint | null>(null);
  const [algIndex, setAlgIndex] = useState(0);
  const exactHintRef = useRef<ExactHint | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoRedoRef = useRef<{ kind: 'undo' | 'redo'; original: Move } | null>(null);

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
    const info = detectStage(state);
    setStage(info);
    const exact = getExactHint(state, n, info.stage);
    const prev = exactHintRef.current;
    const same = prev && exact && prev.category === exact.category && prev.caseName === exact.caseName;
    if (!same) {
      exactHintRef.current = exact;
      setExactHint(exact);
      setAlgIndex(0);
      if (exact) sceneRef.current?.orientFront(exact.requiredFront);
    }
    resetHintTimer();
  }, [resetHintTimer, n]);

  const handleMoveApplied = useCallback((move: Move) => {
    const pending = undoRedoRef.current;
    undoRedoRef.current = null;
    if (pending?.kind === 'undo') {
      setHistory((h) => h.slice(0, -1));
      setRedoStack((r) => [...r, pending.original]);
      return;
    }
    if (pending?.kind === 'redo') {
      setHistory((h) => [...h, pending.original]);
      setRedoStack((r) => r.slice(0, -1));
      return;
    }
    setHistory((h) => [...h, move]);
    setRedoStack([]);

    const current = exactHintRef.current;
    if (current && !move.whole) {
      setAlgIndex((idx) => {
        const expected = current.moves[idx];
        if (!expected) return idx;
        const visualLabel = move.slice ?? inverseOrientationRef.current[move.face];
        const expectedLabel = expected.slice ?? expected.face;
        if (visualLabel === expectedLabel && move.turns === expected.turns) return idx + 1;
        return idx;
      });
    }
  }, []);

  const handleMove = useCallback((move: Move) => {
    // Buttons/keyboard use fixed visual labels (U/D/L/R/F/B); remap to whichever world
    // face is currently occupying that visual position so turns match what's on screen.
    const resolved = move.slice ? move : { ...move, face: orientationRef.current[move.face] };
    sceneRef.current?.pushMove(resolved);
    resetHintTimer();
  }, [resetHintTimer]);

  const handleFlip = useCallback(() => {
    // Rotates the whole cube (not a layer) so top and bottom swap - like
    // physically picking the cube up and turning it over. Uses the same
    // visual-to-world remap as face turns, so it flips around whatever is
    // currently the left-right axis on screen, regardless of camera angle.
    handleMove({ face: 'R', depth: 1, turns: 2, whole: true });
  }, [handleMove]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    undoRedoRef.current = { kind: 'undo', original: last };
    sceneRef.current?.pushMove(invertMove(last));
    resetHintTimer();
  }, [history, resetHintTimer]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    undoRedoRef.current = { kind: 'redo', original: next };
    sceneRef.current?.pushMove(next);
    resetHintTimer();
  }, [redoStack, resetHintTimer]);

  const { bindings, setBinding, resetBindings } = useKeyBindings();
  useKeyboardControls(n, handleMove, false, bindings);
  const [bindingsOpen, setBindingsOpen] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);

  const [isTouch] = useState(() => window.matchMedia('(hover: none) and (pointer: coarse)').matches);

  const handleSizeChange = (newN: 3 | 4 | 5) => {
    setN(newN);
    setSceneKey((k) => k + 1);
    const fresh = new CubeState(newN);
    setCubeState(fresh);
    setStage(detectStage(fresh));
    setHistory([]);
    setRedoStack([]);
    exactHintRef.current = null;
    setExactHint(null);
    undoRedoRef.current = null;
  };

  const handleScramble = () => {
    const moves = randomScramble(n);
    sceneRef.current?.scramble(moves);
    setHistory([]);
    setRedoStack([]);
    resetHintTimer();
  };

  const handlePractice = useCallback((llCase: LLCase) => {
    sceneRef.current?.reset();
    const setupMoves = [...llCase.moves].reverse().map(invertMove);
    sceneRef.current?.scramble(setupMoves);
    setHistory([]);
    setRedoStack([]);
    setPracticeOpen(false);
    // Skip the usual idle wait - practicing a case should show its algorithm right away.
    setShowHint(true);
    if (hintTimer.current) clearTimeout(hintTimer.current);
  }, []);

  const handleReset = () => {
    sceneRef.current?.reset();
    const fresh = new CubeState(n);
    setCubeState(fresh);
    setStage(detectStage(fresh));
    setHistory([]);
    setRedoStack([]);
    exactHintRef.current = null;
    setExactHint(null);
    undoRedoRef.current = null;
    resetHintTimer();
  };

  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const canFullscreen = typeof document !== 'undefined' && Boolean(document.documentElement.requestFullscreen);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
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
          <button className="icon-btn" onClick={handleUndo} disabled={history.length === 0} title="Undo" aria-label="Undo">
            ↶
          </button>
          <button className="icon-btn" onClick={handleRedo} disabled={redoStack.length === 0} title="Redo" aria-label="Redo">
            ↷
          </button>
          <button className="icon-btn" onClick={handleFlip} title="Flip the whole cube (swap top/bottom)" aria-label="Flip cube">
            ⇅
          </button>
          <button className="ghost-btn" onClick={handleScramble}>Scramble</button>
          <button className="ghost-btn" onClick={handleReset}>Reset</button>
          {n === 3 && (
            <button className="ghost-btn" onClick={() => setPracticeOpen(true)}>Practice a case</button>
          )}
          <button className="icon-btn" onClick={() => setBindingsOpen(true)} title="Keyboard bindings" aria-label="Keyboard bindings">
            ⌨
          </button>
          {canFullscreen && (
            <button className="icon-btn" onClick={toggleFullscreen} title={isFullscreen ? 'Exit full screen' : 'Full screen'} aria-label="Toggle full screen">
              {isFullscreen ? '⤡' : '⤢'}
            </button>
          )}
        </div>
      </header>

      <div className="stage-bar">
        <span className="stage-pill">
          <span className="stage-dot" />
          {stage.title}
        </span>
        {!isTouch && (
          <span className="kbd-hint">
            WASD orbit view &nbsp;·&nbsp; Shift ' &nbsp;·&nbsp; Ctrl wide &nbsp;·&nbsp;
            <button className="kbd-hint-link" onClick={() => setBindingsOpen(true)}>edit turn keys ⌨</button>
          </span>
        )}
        <span className="move-count">{history.length} moves</span>
      </div>

      <main className="play-area">
        <LeftButtonPanel n={n} onMove={handleMove} disabled={false} />

        <div className="scene-wrap">
          <CubeScene
            key={sceneKey}
            ref={sceneRef}
            n={n}
            blindMode={blindMode}
            onStateChange={handleStateChange}
            onFrontFaceChange={() => {}}
            onOrientationChange={(map) => {
              orientationRef.current = map;
              const inverse = { ...IDENTITY_ORIENTATION };
              (Object.keys(map) as FaceId[]).forEach((visual) => {
                inverse[map[visual]] = visual;
              });
              inverseOrientationRef.current = inverse;
            }}
            onAnimatingChange={() => {}}
            onMoveApplied={handleMoveApplied}
          />
          {showHint && stage.stage !== 'solved' && (
            <div className="hint-popover">
              {exactHint ? (
                <>
                  <p>{exactHint.category}: {exactHint.caseName}</p>
                  <div className="alg-tokens">
                    {exactHint.moves.map((step, i) => (
                      <span
                        key={i}
                        className={`alg-token ${i < algIndex ? 'alg-token-done' : ''} ${i === algIndex ? 'alg-token-next' : ''}`}
                      >
                        {moveToNotation(step)}
                      </span>
                    ))}
                  </div>
                  {algIndex >= exactHint.moves.length && <p className="hint-text">Case solved!</p>}
                </>
              ) : (
                <>
                  <p>Want a hint?</p>
                  <p className="hint-text">{stage.hint}</p>
                </>
              )}
              <button onClick={() => setShowHint(false)}>Got it</button>
            </div>
          )}
          {stage.stage === 'solved' && <div className="solved-banner">Solved 🎉</div>}
        </div>

        <RightButtonPanel n={n} onMove={handleMove} disabled={false} />
      </main>

      <SliceBar n={n} onMove={handleMove} disabled={false} />

      {bindingsOpen && (
        <BindingsPanel
          bindings={bindings}
          onSetBinding={setBinding}
          onReset={resetBindings}
          onClose={() => setBindingsOpen(false)}
        />
      )}

      {practiceOpen && (
        <PracticePanel onPick={handlePractice} onClose={() => setPracticeOpen(false)} />
      )}
    </div>
  );
}

export default App;
