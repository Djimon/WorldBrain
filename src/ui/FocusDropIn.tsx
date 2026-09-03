// M10-S7 (#426): the opt-in focus "drop-in".
//
// Free-Browse principle: a player is NEVER locked to a view the DM shares — their
// view NEVER switches automatically. Instead, when the DM presents/focuses something
// (0.1: a map), a floating card appears for the PLAYER. It floats above every view
// and STAYS visible no matter which sidebar view the player switches to; it vanishes
// only when the player navigates to the focus view themselves. Click → jump to the
// DM's focus view.
//
// Data source (D30 membrane): the presented focus arrives via the transport-fed
// play-client-store (host push: pushPresentedMapSnapshot) — the player reads it
// DB-less from `store.list('map')`, exactly like the player PlayCockpitMap path.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PlayClientStoreImpl } from '../services/play-client-store';
import { FloatingCard } from './primitives';

export interface FocusDropInProps {
  /** The player's transport-fed store (null before a snapshot arrives). */
  store: PlayClientStoreImpl | null;
  /** The player's currently active sidebar view. */
  activeArea: string;
  /** The sidebar view the DM focus lives in (0.1: presented map → 'maps'). */
  focusArea: string;
  /** Jump the player to the focus view. */
  onJump: () => void;
}

export function FocusDropIn({ store, activeArea, focusArea, onJump }: FocusDropInProps) {
  const { t } = useTranslation('multiplayer');
  const [, setTick] = useState(0);

  // Re-render when the store receives a new snapshot/delta (focus set/cleared).
  useEffect(() => {
    if (!store) return;
    return store.subscribe(() => setTick((n) => n + 1));
  }, [store]);

  if (!store) return null;
  const mapEntity = store.list('map')[0] ?? null;
  if (mapEntity === null) return null;        // no active DM focus → no drop-in
  if (activeArea === focusArea) return null;   // player already at the focus view

  const rawTitle = String((mapEntity.data as Record<string, unknown>).title ?? '');
  const title = rawTitle !== '' ? rawTitle : t('focus.dropInMap');

  return (
    <FloatingCard pulse onClick={onJump} aria-label={t('focus.dropInLabel')}>
      {t('focus.dropIn', { title })}
    </FloatingCard>
  );
}

export default FocusDropIn;
