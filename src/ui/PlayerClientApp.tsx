import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlayerProjectDashboard } from './PlayerProjectDashboard';
import { PlayerJoinView } from './PlayerJoinView';
import { SignalingPanel } from './SignalingPanel';

type View = 'dashboard' | 'join';

export function PlayerClientApp() {
  const { t } = useTranslation('nav');
  const [view, setView] = useState<View>('dashboard');
  const [signalingOpen, setSignalingOpen] = useState(false);

  function handleJoined(_token: string) {
    setView('dashboard');
    setSignalingOpen(false);
  }

  if (view === 'join') {
    return (
      <div>
        <PlayerJoinView onJoined={handleJoined} />
        <button onClick={() => setSignalingOpen((v) => !v)}>
          {t('playerSignalingToggle', 'Internet-Verbindung (Stufe 3)')}
        </button>
        {signalingOpen && <SignalingPanel role="player" />}
      </div>
    );
  }

  return (
    <PlayerProjectDashboard onJoinNew={() => setView('join')} />
  );
}
