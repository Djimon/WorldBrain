import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import { generateInviteCode } from '../services/session-identity-service';

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
  const [pending, setPending] = useState<Player[]>([]);
  const [approved, setApproved] = useState<Player[]>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [sessionId]);

  async function load() {
    const [p, a, codes] = await Promise.all([
      database.select<Player>(
        `SELECT sp.player_id, p.display_name FROM session_players sp
         JOIN players p ON p.id = sp.player_id
         WHERE sp.session_id = ? AND sp.invite_status = 'pending'`,
        [sessionId],
      ),
      database.select<Player>(
        `SELECT sp.player_id, p.display_name FROM session_players sp
         JOIN players p ON p.id = sp.player_id
         WHERE sp.session_id = ? AND sp.invite_status = 'approved'`,
        [sessionId],
      ),
      database.select<{ code: string }>(
        `SELECT code FROM invite_codes WHERE session_id = ? AND is_active = 1 LIMIT 1`,
        [sessionId],
      ),
    ]);
    setPending(p);
    setApproved(a);
    setInviteCode(codes[0]?.code ?? null);
  }

  async function handleApprove(playerId: string) {
    await database.execute(
      `UPDATE session_players SET invite_status = 'approved' WHERE session_id = ? AND player_id = ?`,
      [sessionId, playerId],
    );
    setPending((prev) => prev.filter((x) => x.player_id !== playerId));
  }

  async function handleReject(playerId: string) {
    await database.execute(
      `DELETE FROM session_players WHERE session_id = ? AND player_id = ?`,
      [sessionId, playerId],
    );
    setPending((prev) => prev.filter((x) => x.player_id !== playerId));
  }

  async function handleKick(playerId: string) {
    await database.execute(
      `DELETE FROM session_players WHERE session_id = ? AND player_id = ?`,
      [sessionId, playerId],
    );
    setApproved((prev) => prev.filter((x) => x.player_id !== playerId));
  }

  async function handleRegenerateCode() {
    const invite = await generateInviteCode(database, sessionId);
    setInviteCode(invite.code);
  }

  return (
    <div>
      <section>
        <h2>{t('lobbyPending', 'Ausstehende Anfragen')}</h2>
        <ul>
          {pending.map((p) => (
            <li key={p.player_id} data-player-id={p.player_id}>
              {p.display_name}
              <button onClick={() => handleApprove(p.player_id)}>
                {t('lobbyApprove', 'Bestätigen')}
              </button>
              <button onClick={() => handleReject(p.player_id)}>
                {t('lobbyReject', 'Ablehnen')}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t('lobbyApproved', 'Verbundene Spieler')}</h2>
        <ul>
          {approved.map((p) => (
            <li key={p.player_id} data-player-id={p.player_id}>
              {p.display_name}
              <button onClick={() => handleKick(p.player_id)}>
                {t('lobbyKick', 'Entfernen')}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        {inviteCode && <span>{inviteCode}</span>}
        <button onClick={handleRegenerateCode}>
          {t('lobbyRegenerateCode', 'Code neu generieren')}
        </button>
      </section>

      {onStartHosting && (
        <button onClick={onStartHosting}>{t('lobbyStartHosting', 'Hosting starten')}</button>
      )}
      {onStopHosting && (
        <button onClick={onStopHosting}>{t('lobbyStopHosting', 'Hosting stoppen')}</button>
      )}
    </div>
  );
}
