// Shared, module-level flag: while true, the cube's own keyboard shortcuts
// (face turns, WASD camera orbit) stop reacting to key events, because the
// bindings panel is actively listening for the next key press to rebind.
export const keyCaptureLock = { locked: false };
