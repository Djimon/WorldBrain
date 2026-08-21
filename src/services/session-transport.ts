// M10-S01 (#350): Transport-Interface (rebuild).
// Renderer redet ausschließlich gegen dieses Interface — die konkrete
// Implementierung ist WebRTC-DataChannel (webrtc-transport.ts). Es gibt
// KEINEN HTTP/WS-Server (D-Aktueller-Stand Pkt. 1).

export interface TransportMessage {
  type: string;
  payload: Record<string, unknown>;
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
  if (keys.length !== 2 || !keys.includes('type') || !keys.includes('payload')) {
    throw new Error('Invalid message: must have exactly type and payload fields');
  }
  if (typeof obj.type !== 'string') {
    throw new Error('Invalid message: type must be a string');
  }
  if (obj.payload === null || typeof obj.payload !== 'object' || Array.isArray(obj.payload)) {
    throw new Error('Invalid message: payload must be a non-null object');
  }
  return obj as unknown as TransportMessage;
}
