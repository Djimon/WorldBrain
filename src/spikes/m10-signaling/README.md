# M10 Signaling-Spike (#380) — throwaway

Empirischer Vergleich: welcher serverlose WebRTC-Signaling-Weg verbindet zwei Peers zuverlässig im echten Tauri-Build.

**Kandidaten (alle hinter EINEM Adapter-Interface `SignalingAdapter`):**

| Key | Modul | Rolle |
|---|---|---|
| `trystero-nostr` | `trystero/nostr` | Ausgangs-Hypothese (Default) |
| `trystero-mqtt` | `trystero/mqtt` | Fallback-Strategie |
| `trystero-bittorrent` | `trystero/torrent` | Fallback-Strategie |
| `peerjs` | `peerjs` (Public Cloud) | alternativer Broker (SPOF) |
| `manual-sdp` | native `RTCPeerConnection` | Copy/Paste-Fallback |

Die 5 Adapter beweisen zugleich D28-Austauschbarkeit: neuer Adapter = neue Datei hinter demselben Interface (v2/v3 self-hosted Relay-Server = weiterer Adapter, kein Rewrite).

## Setup

Dev-Deps installieren (nicht in `package.json` gepinnt — reiner Spike):

```bash
npm i -D trystero peerjs
```

## Laufen (Windows / WebView2)

```bash
npm run desktop:spike-m10-signaling
```

**Zwei Fenster** öffnen (App zweimal starten oder Browser gegen `http://localhost:5173/m10-signaling-spike.html`):
- Fenster 1: Peer = **A**, gleicher **RoomId-Prefix**
- Fenster 2: Peer = **B**, gleicher **RoomId-Prefix**
- In beiden Fenstern denselben Adapter wählen → auf beiden **„Run 10 Cold-Starts"**

## Was der Bench misst

- **10 Cold-Starts** pro Adapter × Plattform
- **Erfolg** = beide Peers feuern `datachannel.onopen` AND ein Ping-Payload round-trippt **< 10 s**
- **Erfassung:** Erfolgsquote (x/10), Median Time-to-Connect, Fehlermeldungen
- **Verwerf-Schwelle:** < 8/10 auf einer Zielplattform → Kandidat fällt für diese Plattform raus

## Plattform-Matrix (fürs Ergebnis-Anhängen)

Nach jedem Run: **Export JSON** → in `planning/research/multiplayer-signaling-broker-options.md` als neuen Abschnitt anhängen. Skelett:

```
| Kandidat            | Win/WebView2 | macOS/WKWebView | Remote (2 Netze) |
|---------------------|--------------|-----------------|------------------|
| trystero-nostr      | x/10 · Xms   | x/10 · Xms      | x/10 · Xms       |
| trystero-mqtt       | …            | …               | …                |
| trystero-bittorrent | …            | …               | …                |
| peerjs              | …            | …               | …                |
| manual-sdp          | n/a          | n/a             | x/10 · Xms       |
```

**Wenn keine macOS-Umgebung verfügbar:** WKWebView-Spalte explizit als `UNGETESTET/offen` markieren — nicht raten. Das ist der Risiko-Punkt der offen bleiben MUSS bis jemand es fährt.

## Was NACH dem Spike passiert

- Befund + Matrix anhängen an `planning/research/multiplayer-signaling-broker-options.md`
- Ergebnis + Empfehlung entscheidet über #367 (S11 WebRTC+STUN) + #368 (S12 serverloses Signaling)
- Dieser Ordner wird **verworfen** — nur der Adapter-Vertrag (Interface) wandert in Produktions-Code
