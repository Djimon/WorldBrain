# Research: Gratis-Signaling-Broker für WebRTC (D28 / M10-S11+S12)

**Stand:** 2026-08 · **Kontext:** Host/Connect-Modell (D28) — DM hostet, Spieler treten per Einladungslink/-Code bei; Spieldaten **P2P host↔Spieler** (WebRTC-DataChannel), Signaling über einen **fremden Gratis-Broker** (kein Selbst-Hosting). Ziel: „Link einfügen → drin" ohne Antwort-Code. App = **Tauri-Desktop** (Windows = WebView2/Chromium).

## Kernfakten (WebRTC-Signaling)
- Signaling ist **nicht** Teil des WebRTC-Standards — jeder Kanal, den beide Peers erreichen, taugt (Nostr-Relay, BitTorrent-Tracker, MQTT, …). Der Broker vermittelt **nur** SDP/ICE beim Verbinden; **Spieldaten laufen danach P2P und sind Ende-zu-Ende-verschlüsselt** — der Broker sieht sie nie.
- **NAT-Tail:** ~10–20 % besonders strenge (symmetrische) NATs verbinden ohne **TURN-Relay** nicht — das ist eine WebRTC-Eigenschaft, **broker-unabhängig**. V1: kein TURN → klare Fehlermeldung (schon im Epic entschieden).

## Optionen

### 1) Trystero (dmotz/trystero) — **EMPFEHLUNG**
- **Was:** MIT-Lib, „magic WebRTC matchmaking" über austauschbare Strategien: **Nostr, MQTT, BitTorrent, IPFS, Supabase, Firebase** + self-hosted WebSocket-Relay. Abstrahiert den Matchmaking-Server komplett weg.
- **Status:** aktiv gepflegt (Update Juni 2026), MIT.
- **Strategien-Ranking (aus Trystero-Doku):**
  - **Nostr** = Default: **hohe** Zuverlässigkeit, **kein** Account/API-Key, gute Privacy, „hunderte aktive Relays" (dezentral → resilient), **kein** Self-Host. → **bester Fit für uns.**
  - MQTT / BitTorrent / IPFS: moderat, kein Key, dezentral (Fallback-Strategien).
  - Supabase / Firebase: hohe Zuverlässigkeit, aber **Gratis-Account/API-Key nötig** + moderate Privacy.
- **Vorteil hier:** Strategie ist **umschaltbar** — degradiert ein Relay-Netz, wechselt man auf ein anderes (billige Resilienz). Daten P2P + E2E.
- **Bekannte Schwächen (ehrlich):**
  - **Skalierung:** Full-Mesh = N² Verbindungen; bei **vielen** Peers Browser-Fehler („Cannot create so many PeerConnections"). → **Für uns irrelevant:** 1 DM + ~4–6 Spieler = winziges Mesh.
  - **Browser-Kompatibilität:** Chrome glatt, Firefox teils laggy, **Safari/WKWebView** am problematischsten (Crashes). → **Windows-WebView2 = Chromium = der glatte Fall.** **macOS (WKWebView) = Test-Risiko** — dort real verifizieren.

### 2) PeerJS + öffentlicher PeerServer-Cloud
- **Was:** einfache API; der Gratis-PeerServer-Cloud macht das Signaling, danach P2P.
- **Limits:** **50 gleichzeitige Verbindungen gratis**, geteilter Server, IDs können kollidieren; „für Produktion selbst hosten". Für eine kleine Runde reicht 50 locker.
- **Nachteil ggü. Trystero:** **ein einzelner Broker** = Single Point of Failure vs. Nostrs viele Relays. Fällt der Cloud-Server aus, ist Schluss (außer man hostet selbst = will man nicht).

### 3) Manueller SDP-Austausch (Offer/Answer copy-paste) — **FALLBACK**
- Kein Broker, funktioniert remote, aber = der **Antwort-Code** (2-Weg). Bereits als **Stufe-3-only-Fallback** (SignalingPanel) vorgesehen (D27/D28) für Broker-Ausfall / harte NAT.

## Empfehlung (löst den D28-Mini-Spike)
1. **Primär: Trystero mit Nostr-Strategie** — MIT, kein Account, kein Self-Host, dezentral/resilient, P2P-E2E, aktiv gepflegt. Small-Group → die Skalierungs-Kritik trifft uns nicht.
2. **Strategie konfigurierbar halten** (Nostr → MQTT/BitTorrent als Fallback-Kette).
3. **Manueller SDP-Fallback** (SignalingPanel, Stufe-3-only) für Broker-down / strenge NAT.
4. **Test-Pflicht:** im echten **Tauri-WebView2 (Windows = Chromium, erwartet gut)** verifizieren; **WKWebView (macOS)** als Risiko explizit gegentesten.
5. **NAT-Tail** akzeptieren (~10–20 %, klare Meldung, kein TURN in V1).

**Alternative,** falls dead-simple API > Dezentralitäts-Resilienz: PeerJS-Cloud (50-Conn gratis) — aber Single-Broker-Fragilität.

## Quellen
- Trystero: https://github.com/dmotz/trystero · https://trystero.dev/docs/
- Trystero Kritik/Limits (2026-08): https://finance.biggo.com/news/202508291313_Trystero_P2P_Library_Issues
- PeerJS Cloud/FAQ: https://peerjs.com/client/faq · https://peerjs.com/server/cloud
- WebRTC ohne Signaling-Server (manueller SDP): https://github.com/lesmana/webrtc-without-signaling-server
