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

export function EmojiPickerHostProvider({ children }: { children: React.ReactNode }) {
  const [warm, setWarm] = useState(false);
  const [request, setRequest] = useState<EmojiPickerOpenRequest | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((fn: IdleRequestCallback) => window.setTimeout(fn, 300));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const id = idle(() => setWarm(true));
    return () => cancel(id as number);
  }, []);

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
            top: position?.top ?? -9999,
            left: position?.left ?? -9999,
            display: request ? 'block' : 'none',
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
