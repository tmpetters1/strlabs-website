import { useEffect, useState } from 'react';
import type { BindableAction } from '../hooks/useKeyBindings';
import { BINDABLE_ACTIONS } from '../hooks/useKeyBindings';
import { keyCaptureLock } from '../hooks/keyCaptureLock';

const ACTION_LABEL: Record<BindableAction, string> = {
  U: 'Turn Up face',
  D: 'Turn Down face',
  L: 'Turn Left face',
  R: 'Turn Right face',
  F: 'Turn Front face',
  B: 'Turn Back face',
};

function codeToLabel(code: string): string {
  if (!code) return 'Unbound';
  if (code === 'Space') return 'Space';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Arrow')) return code.slice(5) + ' arrow';
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

interface BindingsPanelProps {
  bindings: Record<BindableAction, string>;
  onSetBinding: (action: BindableAction, code: string) => void;
  onReset: () => void;
  onClose: () => void;
}

export function BindingsPanel({ bindings, onSetBinding, onReset, onClose }: BindingsPanelProps) {
  const [listeningFor, setListeningFor] = useState<BindableAction | null>(null);

  useEffect(() => {
    if (!listeningFor) return;
    keyCaptureLock.locked = true;
    function onKeyDown(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setListeningFor(null);
        return;
      }
      onSetBinding(listeningFor!, e.code);
      setListeningFor(null);
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      keyCaptureLock.locked = false;
    };
  }, [listeningFor, onSetBinding]);

  return (
    <div className="bindings-overlay" onClick={onClose}>
      <div className="bindings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="bindings-header">
          <h2>Keyboard bindings</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="bindings-note">
          Click a key to rebind it, then press the new key. Hold Shift for a prime turn, Ctrl for a wide turn.
          WASD always orbits the view and can't be rebound.
        </p>
        <div className="bindings-list">
          {BINDABLE_ACTIONS.map((action) => (
            <div key={action} className="bindings-row">
              <span className="bindings-action">{ACTION_LABEL[action]}</span>
              <button
                className={`bindings-key ${listeningFor === action ? 'listening' : ''}`}
                onClick={() => setListeningFor(action)}
              >
                {listeningFor === action ? 'Press a key…' : codeToLabel(bindings[action])}
              </button>
            </div>
          ))}
        </div>
        <button className="ghost-btn" onClick={onReset}>Reset to defaults</button>
      </div>
    </div>
  );
}
