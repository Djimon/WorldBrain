import { useState, useEffect } from 'react';
import { getEffectiveEntity } from '../services/entity-service';
import type { DatabaseLike } from '../services/entity-service';
import { resolveVisibility } from '../services/visibility-service';
import type { VisibilityContext } from '../services/visibility-service';

type EffectiveResult = Awaited<ReturnType<typeof getEffectiveEntity>>;

interface Block {
  type: string;
  text?: string;
  visibility?: string;
}

interface Props {
  context: VisibilityContext;
  entityId?: string;
  database?: DatabaseLike;
  onReveal?: (entityId: string) => void;
}

export function PlayerScreen({ context, entityId, database, onReveal: _onReveal }: Props) {
  const [effectiveResult, setEffectiveResult] = useState<EffectiveResult | null>(null);

  useEffect(() => {
    if (entityId && database) {
      getEffectiveEntity({ database, entityId }).then(setEffectiveResult);
    } else {
      setEffectiveResult(null);
    }
  }, [database, entityId]);

  const entity = effectiveResult?.found ? effectiveResult.entity : null;
  const blocks = (entity?.body as { blocks?: Block[] } | undefined)?.blocks ?? [];

  const visibleBlocks = blocks.filter((b) => {
    const result = resolveVisibility({ visibility: b.visibility ?? 'public' }, context);
    return result !== 'hidden';
  });

  return (
    <div>
      {entity && <h1>{entity.title}</h1>}
      <article>
        {visibleBlocks.map((b, i) => <p key={i}>{b.text}</p>)}
      </article>
    </div>
  );
}

export function PlayerScreenLauncher() {
  const [_open, setOpen] = useState(false);

  async function handleOpen() {
    const { WebviewWindow } = await import('@tauri-apps/api/window');
    new WebviewWindow('player-screen', { url: 'player.html' });
    setOpen(true);
  }

  return (
    <div>
      <button onClick={handleOpen}>Open Player Screen</button>
    </div>
  );
}
