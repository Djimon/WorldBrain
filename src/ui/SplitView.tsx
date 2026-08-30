// M10-S19 (issue 364, D21): generischer In-App 2-Pane-Split-View mit verschiebbarer
// Grenze. Beliebige 2 Ansichten nebeneinander (z.B. DM: Map ‖ Kampflog).
// V1 = NUR In-App-Split; KEIN OS-Pop-out (ausdrücklich out of scope).
//
// Die Grenze wird per Maus-Drag (oder Tastatur auf dem Divider) verschoben;
// die Ratio ist State und fließt als dynamisches flex-basis in die linke Pane.
// Kein horizontales Body-Scrolling — Container clippt, Panes scrollen in sich
// (siehe split-view.css).
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface SplitViewProps {
  /** Linke/primäre Ansicht. */
  primary: React.ReactNode;
  /** Rechte/sekundäre Ansicht. */
  secondary: React.ReactNode;
  /** Start-Ratio der linken Pane in Prozent (10–90). Default 50. */
  initialRatio?: number;
  /** Untere/obere Klammer für die Ratio in Prozent. Default 15/85. */
  minRatio?: number;
  maxRatio?: number;
  className?: string;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export function SplitView({
  primary,
  secondary,
  initialRatio = 50,
  minRatio = 15,
  maxRatio = 85,
  className,
}: SplitViewProps) {
  const { t } = useTranslation();
  const [ratio, setRatio] = useState(clamp(initialRatio, minRatio, maxRatio));
  const containerRef = useRef<HTMLDivElement | null>(null);

  const applyClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (el === null) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setRatio(clamp(pct, minRatio, maxRatio));
  }, [minRatio, maxRatio]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const move = (ev: PointerEvent) => applyClientX(ev.clientX);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [applyClientX]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowLeft') setRatio((r) => clamp(r - 2, minRatio, maxRatio));
    else if (e.key === 'ArrowRight') setRatio((r) => clamp(r + 2, minRatio, maxRatio));
  }, [minRatio, maxRatio]);

  const rootClass = className !== undefined ? `split-view ${className}` : 'split-view';

  return (
    <div ref={containerRef} className={rootClass}>
      <div className="split-view__pane split-view__pane--primary" style={{ flex: `0 0 ${ratio}%` }}>
        {primary}
      </div>
      <button
        type="button"
        className="split-view__divider"
        role="separator"
        aria-orientation="vertical"
        aria-label={t('splitView.divider', 'Grenze verschieben')}
        aria-valuenow={Math.round(ratio)}
        aria-valuemin={minRatio}
        aria-valuemax={maxRatio}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
      />
      <div className="split-view__pane split-view__pane--secondary" style={{ flex: `1 1 ${100 - ratio}%` }}>
        {secondary}
      </div>
    </div>
  );
}

export default SplitView;
