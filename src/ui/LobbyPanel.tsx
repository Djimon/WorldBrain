import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import { generateInviteCode, kick } from '../services/session-identity-service';
import { Button, Field } from './primitives';

interface Player {
  player_id: string;
  display_name: string;
}

interface Props {
  database: DatabaseLike;
  sessionId: string;
  onStartHosting?: () => void;
  onStopHosting?: () => void;
}

export function LobbyPanel({ database, sessionId, onStartHosting, onStopHosting }: Props) {
  const { t } = useTranslation('nav');
  const [active, setActive] = useState<Player[]>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [sessionId]);

  async function load() {
    const [players, codes] = await Promise.all([
      database.select<Player>(
        `SELECT sp.player_id, p.display_name FROM session_players sp
         JOIN players p ON p.id = sp.player_id
         WHERE sp.session_id = ? AND sp.status = 'active'`,
        [sessionId],
      ),
      database.select<{ code: string }>(
        `SELECT code FROM invite_codes WHERE session_id = ? AND is_active = 1 LIMIT 1`,
        [sessionId],
      ),
    ]);
    setActive(players);
    setInviteCode(codes[0]?.code ?? null);
  }

  async function handleKick(playerId: string) {
    await kick(database, { playerId, sessionId });
    setActive((prev) => prev.filter((x) => x.player_id !== playerId));
  }

  async function handleRegenerateCode() {
    const invite = await generateInviteCode(database, sessionId);
    setInviteCode(invite.code);
  }

  async function handleCopyCode() {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode);
  }

  async function handleCopyLink() {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(
      `worldbuilderx://join?session=${sessionId}&code=${inviteCode}`,
    );
  }

  const invitationLink = inviteCode
    ? `worldbuilderx://join?session=${sessionId}&code=${inviteCode}`
    : '';

  return (
    <div>
      <section>
        <h2>{t('lobbyActive', 'Verbundene Spieler')}</h2>
        <ul>
          {active.map((p) => (
            <li key={p.player_id} data-player-id={p.player_id}>
              {p.display_name}
              <Button tone="neutral" onClick={() => void handleKick(p.player_id)}>
                {t('lobbyKick', 'Kick')}
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <Field
          label={t('lobbyInviteCode', 'Einladungscode')}
          readOnly
          value={inviteCode ?? ''}
        />
        <Button tone="neutral" onClick={() => void handleCopyCode()}>
          {t('lobbyCopy', 'Kopieren')}
        </Button>
        {inviteCode && (
          <>
            <Field
              label={t('lobbyInviteLink', 'Einladungslink')}
              readOnly
              value={invitationLink}
            />
            <Button tone="neutral" onClick={() => void handleCopyLink()}>
              {t('lobbyCopyLink', 'Link teilen')}
            </Button>
          </>
        )}
        <Button onClick={() => void handleRegenerateCode()}>
          {t('lobbyRegenerateCode', 'Code neu generieren')}
        </Button>
      </section>

      {onStartHosting && (
        <Button onClick={onStartHosting}>{t('lobbyStartHosting', 'Hosting starten')}</Button>
      )}
      {onStopHosting && (
        <Button onClick={onStopHosting}>{t('lobbyStopHosting', 'Hosting stoppen')}</Button>
      )}
    </div>
  );
}
