// #310 follow-up: a single, persistent EmojiPicker instance shared by every
// ClipEditor for the lifetime of the soundboard session, instead of each
// editor mounting (and paying the ~1900-emoji-grid render cost for) its own.
// Warmed once on browser idle time; every later "open" from any clip/channel
// just retargets and repositions the already-built instance via a portal.
//
// Optional by design: consumers call useEmojiPickerHost(), which returns
// null when no EmojiPickerHostProvider is mounted (e.g. isolated component
// tests) — callers fall back to their own local instance in that case.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EmojiPicker } from './EmojiPicker';

export interface EmojiPickerOpenRequest {
  value: string | null;
  onSelect: (emoji: string) => void;
  anchor: HTMLElement;
}

export interface EmojiPickerHostContextValue {
  open: (request: EmojiPickerOpenRequest) => void;
}

const EmojiPickerHostContext = createContext<EmojiPickerHostContextValue | null>(null);

export function useEmojiPickerHost(): EmojiPickerHostContextValue | null {
  return useContext(EmojiPickerHostContext);
}

export interface EmojiPickerHostProviderProps {
  children: React.ReactNode;
  /** Only start the idle warm-up once this is true (default true — pass
      false while other startup work, e.g. loading the board's channels,
      should get the main thread first). Flipping true later starts the
      warm-up at that point, not retroactively. */
  warmAfter?: boolean;
}

export function EmojiPickerHostProvider({ children, warmAfter = true }: EmojiPickerHostProviderProps) {
  const [warm, setWarm] = useState(false);
  const [request, setRequest] = useState<EmojiPickerOpenRequest | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!warmAfter) return;
    const idle = window.requestIdleCallback ?? ((fn: IdleRequestCallback) => window.setTimeout(fn, 300));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const id = idle(() => setWarm(true));
    return () => cancel(id as number);
  }, [warmAfter]);

  const open = useCallback((req: EmojiPickerOpenRequest) => {
    const rect = req.anchor.getBoundingClientRect();
    setPosition({ top: rect.bottom + 4, left: rect.left });
    setRequest(req);
    setWarm(true);
  }, []);

  useEffect(() => {
    if (!request) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (request!.anchor.contains(target)) return;
      setRequest(null);
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [request]);

  return (
    <EmojiPickerHostContext.Provider value={{ open }}>
      {children}
      {warm && createPortal(
        <div
          ref={containerRef}
          className="emoji-picker-host"
          style={{
            position: 'fixed',
            top: request ? (position?.top ?? -9999) : -9999,
            left: request ? (position?.left ?? -9999) : -9999,
            // visibility (not display) — display:none removes the subtree
            // from the render tree entirely, so the browser never lays out
            // the ~1900-cell grid while idle-warming under display:none, and
            // the FIRST real open still pays that full layout cost, same as
            // never warming at all. visibility:hidden still triggers real
            // layout while off-screen, which is the actual point of warming
            // this ahead of time.
            visibility: request ? 'visible' : 'hidden',
            pointerEvents: request ? 'auto' : 'none',
            zIndex: 1000,
          }}
        >
          <EmojiPicker
            value={request?.value ?? null}
            onSelect={(emoji) => { request?.onSelect(emoji); setRequest(null); }}
          />
        </div>,
        document.body,
      )}
    </EmojiPickerHostContext.Provider>
  );
}
