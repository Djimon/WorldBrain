// Manual SDP exchange (offer/answer copy-paste) — the broker-less fallback
// (D27/D28). No broker means: the user pastes SDP blobs by hand between
// two sides. The bench here does NOT measure the time-to-connect against the
// broker (there is none), only whether both go open after paste.
//
// Roles: one side calls `create({peerLabel:'A'})` → becomes the 'offer' role;
// the other `create({peerLabel:'B'})` → becomes the 'answer' role. The UI shows
// the blobs to copy + an input field for the counterpart blob.
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

  // Collect trickle ICE — we wait for the `null` candidate as the end marker.
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
          // Panel update: after paste the 'answer' side now shows its blob.
          opts.requestUiPanel?.({
            role: 'answer',
            localBlob: answerBlob,
            onRemoteBlob: () => { /* answer side is done */ },
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
