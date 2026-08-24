// M10-S01 (#350) + M10-S02 (#351): Transport-Interface (rebuild).
// Renderer redet ausschließlich gegen dieses Interface — die konkrete
// Implementierung ist WebRTC-DataChannel (webrtc-transport.ts). Es gibt
// KEINEN HTTP/WS-Server (D-Aktueller-Stand Pkt. 1).
//
// Decision 8 (S02): JEDE Nachricht trägt das Player-Token. Der Host validiert
// pro Nachricht (nicht nur beim Handshake) via session-identity-service.
// validateToken — ohne gültiges aktives Token wird die Nachricht verworfen.

export interface TransportMessage {
  type: string;
  payload: Record<string, unknown>;
  /** Player-Token (S02 Decision 8): host-seitig pro Nachricht geprüft.
   *  Der DM/System-Sender darf hier auch einen Marker verwenden — für die
   *  echte Auth kommt es nur auf gehostete Client-Nachrichten an. */
  token: string;
}

export interface SessionTransport {
  /** Öffnet die Peer-Verbindung (Host: DataChannel bereitstellen). */
  connect(): Promise<void>;
  /** Schließt die Peer-Verbindung — an den Campaign-Lebenszyklus gekoppelt. */
  close(): Promise<void>;
  /** Sendet eine bereits schema-konforme Nachricht. */
  send(msg: TransportMessage): Promise<void>;
  /** Registriert einen Empfänger für host-seitig validierte Eingaben. */
  onMessage(cb: (msg: TransportMessage) => void): void;
}

/**
 * Host-seitige Schema-Validierung eingehender Nachrichten (AC).
 * Ungültige Payloads → Throw; der Aufrufer verwirft die Nachricht.
 */
export function validateIncomingMessage(raw: unknown): TransportMessage {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid message: must be a non-null object');
  }
  const obj = raw as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length !== 3 || !keys.includes('type') || !keys.includes('payload') || !keys.includes('token')) {
    throw new Error('Invalid message: must have exactly type, payload, and token fields');
  }
  if (typeof obj.type !== 'string') {
    throw new Error('Invalid message: type must be a string');
  }
  if (typeof obj.token !== 'string' || obj.token === '') {
    throw new Error('Invalid message: token must be a non-empty string');
  }
  if (obj.payload === null || typeof obj.payload !== 'object' || Array.isArray(obj.payload)) {
    throw new Error('Invalid message: payload must be a non-null object');
  }
  return obj as unknown as TransportMessage;
}
