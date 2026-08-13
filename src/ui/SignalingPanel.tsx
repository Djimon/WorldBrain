import type React from 'react';

export interface SignalingPanelProps {
  role: 'host' | 'player';
  onOfferReady?: (offerCode: string) => void;
  onConnectionEstablished?: () => void;
}

export function SignalingPanel(_props: SignalingPanelProps): React.ReactElement {
  throw new Error('not implemented');
}
