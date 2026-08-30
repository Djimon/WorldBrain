// M10-S21 (#365, D23): Promote-Schalter — hebt den GANZEN Campaign-Override
// einer Entity in die Welt-Basis (opt-in, ein Klick) und nimmt ihn reversibel
// zurück. Erscheint nur im Campaign-Kontext (EntityDetailView mit campaignId);
// beim Editieren der reinen Welt-Basis gibt es keinen Override zu promoten.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import { promoteOverride, unpromoteOverride, isPromoted } from '../services/campaign-override-service';
import { Button, StatusChip } from './primitives';

export interface PromoteControlProps {
  database: DatabaseLike;
  campaignId: string;
  entityId: string;
  /** Nach Promote/Unpromote — Parent kann seine effektive Sicht neu laden. */
  onChanged?: () => void;
}

export function PromoteControl({ database, campaignId, entityId, onChanged }: PromoteControlProps) {
  const { t } = useTranslation('multiplayer');
  const [promoted, setPromoted] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void isPromoted(database, { campaignId, entityId }).then((p) => {
      if (!cancelled) setPromoted(p);
    });
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
