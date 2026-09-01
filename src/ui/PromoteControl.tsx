// M10-S21 (#365, D23): promote switch — lifts the ENTIRE campaign override
// of an entity into the world base (opt-in, one click) and takes it back
// reversibly. Appears only in the campaign context (EntityDetailView with campaignId);
// when editing the pure world base there is no override to promote.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import { promoteOverride, unpromoteOverride, isPromoted } from '../services/campaign-override-service';
import { Button, StatusChip } from './primitives';

export interface PromoteControlProps {
  database: DatabaseLike;
  campaignId: string;
  entityId: string;
  /** After promote/unpromote — the parent can reload its effective view. */
  onChanged?: () => void;
}

export function PromoteControl({ database, campaignId, entityId, onChanged }: PromoteControlProps) {
  const { t } = useTranslation('multiplayer');
  const [promoted, setPromoted] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void isPromoted(database, { campaignId, entityId })
      .then((p) => { if (!cancelled) setPromoted(p); })
      .catch(() => { if (!cancelled) setPromoted(false); });
    return () => { cancelled = true; };
  }, [database, campaignId, entityId]);

  async function handlePromote() {
    setBusy(true);
    setError(null);
    try {
      await promoteOverride(database, { campaignId, entityId });
      setPromoted(true);
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnpromote() {
    setBusy(true);
    setError(null);
    try {
      await unpromoteOverride(database, { campaignId, entityId });
      setPromoted(false);
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="promote-control u-row u-gap-2" role="group"
      aria-label={t('promote.label', 'In die Welt übernehmen')}>
      {promoted ? (
        <>
          <StatusChip tone="success">{t('promote.statePromoted', 'In der Welt')}</StatusChip>
          <Button size="compact" variant="outline" disabled={busy} onClick={() => void handleUnpromote()}>
            {t('promote.undo', 'Zurücknehmen')}
          </Button>
        </>
      ) : (
        <Button tone="accent" size="compact" disabled={busy} onClick={() => void handlePromote()}>
          {t('promote.action', 'In die Welt übernehmen')}
        </Button>
      )}
      {error !== null && <StatusChip tone="failure" role="alert">{error}</StatusChip>}
    </div>
  );
}

export default PromoteControl;
