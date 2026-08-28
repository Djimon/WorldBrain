// Manueller SDP-Austausch (Offer/Answer copy-paste) — der Broker-lose Fallback
// (D27/D28). Kein Broker heißt: der User klebt SDP-Blobs von Hand zwischen
// zwei Seiten. Der Bench misst hier NICHT die Time-to-Connect gegen den
// Broker (den gibt's nicht), sondern nur ob nach Paste beide open werden.
//
// Rollen: eine Seite ruft `create({peerLabel:'A'})` → wird 'offer'-Rolle;
// die andere `create({peerLabel:'B'})` → wird 'answer'-Rolle. Die UI zeigt
// die zu kopierenden Blobs + Eingabefeld für den Gegen-Blob.
import type { AdapterFactory } from '../types';

export const manualSdpAdapter: AdapterFactory = async (opts) => {
  const isOffer = opts.peerLabel === 'A';
  const pc = new RTCPeerConnection();
  let opened = false;
  let dc: RTCDataChannel | null = null;

  function attachChannel(channel: RTCDataChannel) {
    dc = channel;
    channel.onopen = () => { if (!opened) { opened = true; opts.onOpen(); } };
    channel.onmessage = (ev) => opts.onMessage('remote', ev.data);
    channel.onerror = () => opts.onError(new Error('DataChannel error'));
  }

  if (isOffer) {
    attachChannel(pc.createDataChannel('spike'));
  } else {
    pc.ondatachannel = (ev) => attachChannel(ev.channel);
  }

  // Trickle-ICE einsammeln — wir warten auf `null`-Kandidat als Ende-Marker.
  const iceComplete = new Promise<void>((resolve) => {
    pc.onicecandidate = (ev) => { if (ev.candidate === null) resolve(); };
  });

  let sdpLocal: string;
  if (isOffer) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await iceComplete;
    sdpLocal = JSON.stringify(pc.localDescription);
  } else {
    sdpLocal = '__awaiting_offer__';
  }

  opts.requestUiPanel?.({
    role: isOffer ? 'offer' : 'answer',
    localBlob: sdpLocal,
    onRemoteBlob: async (blob) => {
      try {
        const parsed: RTCSessionDescriptionInit = JSON.parse(blob);
        await pc.setRemoteDescription(parsed);
        if (!isOffer) {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await iceComplete;
          const answerBlob = JSON.stringify(pc.localDescription);
          // Panel-Update: nach Paste zeigt die 'answer'-Seite jetzt ihren Blob.
          opts.requestUiPanel?.({
            role: 'answer',
            localBlob: answerBlob,
            onRemoteBlob: () => { /* answer-Seite ist fertig */ },
          });
        }
      } catch (e) {
        opts.onError(e instanceof Error ? e : new Error(String(e)));
      }
    },
  });

  return {
    send(payload) { if (dc?.readyState === 'open') dc.send(String(payload)); },
    async close() { dc?.close(); pc.close(); },
  };
};
