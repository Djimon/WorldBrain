import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface SignalingPanelProps {
  role: 'host' | 'player';
  onOfferReady?: (offerCode: string) => void;
  onConnectionEstablished?: () => void;
}

export function SignalingPanel({ role, onOfferReady, onConnectionEstablished }: SignalingPanelProps): React.ReactElement {
  const { t } = useTranslation('nav');
  const [offerCode, setOfferCode] = useState('');
  const [answerInput, setAnswerInput] = useState('');
  const [offerInput, setOfferInput] = useState('');
  const [answerCode, setAnswerCode] = useState('');
  const [error, setError] = useState('');
  const [pc, setPc] = useState<RTCPeerConnection | null>(null);

  useEffect(() => {
    if (role !== 'host') return;
    const conn = new RTCPeerConnection();
    setPc(conn);

    const start = async () => {
      const offer = await conn.createOffer();
      await conn.setLocalDescription(offer);

      await new Promise<void>((resolve) => {
        if (conn.iceGatheringState === 'complete') { resolve(); return; }
        conn.onicegatheringstatechange = () => {
          if (conn.iceGatheringState === 'complete') resolve();
        };
      });

      const encoded = btoa(JSON.stringify(conn.localDescription));
      setOfferCode(encoded);
      onOfferReady?.(encoded);
    };

    void start();
    return () => conn.close();
  }, [role]);

  const handleSubmitAnswer = async () => {
    setError('');
    try {
      const decoded = atob(answerInput);
      const sdp = JSON.parse(decoded) as RTCSessionDescriptionInit;
      if (!pc) return;
      await pc.setRemoteDescription(sdp);
      onConnectionEstablished?.();
    } catch {
      setError(t('signalingAnswerError', 'Ungültiger Antwort-Code'));
    }
  };

  const handleProcessOffer = async () => {
    setError('');
    try {
      const decoded = atob(offerInput);
      const offerSdp = JSON.parse(decoded) as RTCSessionDescriptionInit;
      const conn = new RTCPeerConnection();
      await conn.setRemoteDescription(offerSdp);
      const answer = await conn.createAnswer();
      await conn.setLocalDescription(answer);

      await new Promise<void>((resolve) => {
        if (conn.iceGatheringState === 'complete') { resolve(); return; }
        conn.onicegatheringstatechange = () => {
          if (conn.iceGatheringState === 'complete') resolve();
        };
      });

      const encoded = btoa(JSON.stringify(conn.localDescription));
      setAnswerCode(encoded);
    } catch {
      setError(t('signalingOfferError', 'Ungültiger Angebots-Code'));
    }
  };

  if (role === 'host') {
    return (
      <div>
        <p>{t('signalingStep1', 'Schritt 1: Kopiere diesen Code und sende ihn dem Spieler.')}</p>
        <div data-testid="offer-code">{offerCode}</div>

        <p>{t('signalingStep2', 'Schritt 2: Füge den Antwort-Code des Spielers ein.')}</p>
        <input
          data-testid="answer-code-input"
          value={answerInput}
          onChange={(e) => setAnswerInput(e.target.value)}
          aria-label={t('signalingAnswerLabel', 'Antwort-Code')}
        />
        <button data-testid="submit-answer-code" onClick={() => void handleSubmitAnswer()}>
          {t('signalingConnect', 'Verbinden')}
        </button>

        {error && <div role="alert">{error}</div>}
      </div>
    );
  }

  return (
    <div>
      <p>{t('signalingPlayerStep1', 'Schritt 1: Füge den Code des Hosts ein.')}</p>
      <input
        data-testid="offer-code-input"
        value={offerInput}
        onChange={(e) => setOfferInput(e.target.value)}
        aria-label={t('signalingOfferLabel', 'Angebots-Code')}
      />
      <button data-testid="process-offer-code" onClick={() => void handleProcessOffer()}>
        {t('signalingProcessOffer', 'Verarbeiten')}
      </button>

      {answerCode && <div data-testid="answer-code">{answerCode}</div>}
      {error && <div role="alert">{error}</div>}
    </div>
  );
}
