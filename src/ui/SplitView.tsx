// M10-S19 (issue 364, D21): generic in-app 2-pane split view with a movable
// divider. Any 2 views side by side (e.g. DM: Map ‖ Combat log).
// V1 = ONLY in-app split; NO OS pop-out (explicitly out of scope).
//
// The divider is moved by mouse drag (or keyboard on the divider);
// the ratio is state and flows as a dynamic flex-basis into the left pane.
// No horizontal body scrolling — the container clips, panes scroll internally
// (see split-view.css).
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface SplitViewProps {
  /** Left/primary view. */
  primary: React.ReactNode;
  /** Right/secondary view. */
  secondary: React.ReactNode;
  /** Start ratio of the left pane in percent (10–90). Default 50. */
  initialRatio?: number;
  /** Lower/upper bound for the ratio in percent. Default 15/85. */
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
