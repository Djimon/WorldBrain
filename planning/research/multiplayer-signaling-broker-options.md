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

---

## Spike-Harness (#380, 2026-08) — Windows-Zeile gefahren

Wegwerf-Harness liegt unter `src/spikes/m10-signaling/` und implementiert **EIN** `SignalingAdapter`-Interface mit 5 Adaptern (`trystero-nostr`, `trystero-mqtt`, `trystero-bittorrent`, `peerjs`, `manual-sdp`) — apples-to-apples hinter derselben Fassade. Das beweist zugleich die D28-**Austauschbarkeit**: v2/v3-Eigen-Relay = weiterer Adapter, kein Rewrite.

**Setup:**
```
npm i -D trystero @trystero-p2p/mqtt @trystero-p2p/torrent peerjs
npm run desktop:spike-m10-signaling
```

**Mess-Mechanik:** 10 Cold-Starts pro Adapter × Plattform; Erfolg = beide Peers `datachannel.onopen` + Ping-Roundtrip < 10 s; Verwerf-Schwelle < 8/10.

**Scope-Cut (2026-08):** macOS/WKWebView aus dem Multiplayer-Scope genommen — Bench nur noch Windows + Remote-NAT.

### Ergebnis-Matrix

| Kandidat            | Windows / WebView2 (Edge 151)         | Remote (2 Netze) |
|---------------------|---------------------------------------|------------------|
| trystero-nostr      | **A 10/10 · 24 ms** · **B 10/10 · 20 ms** ✅ | PENDING          |
| trystero-mqtt       | **A 10/10 · 19 ms** · **B 10/10 · 24 ms** ✅ | PENDING          |
| trystero-bittorrent | **A 9/10 · 28 ms** · **B 9/10 · 22 ms** ✅¹  | PENDING          |
| peerjs              | **A 10/10 · 216 ms** · **B 9/10 · 216 ms** ✅ | PENDING          |
| manual-sdp          | n/a — Copy/Paste, nicht auto-benchbar  | PENDING (manuell) |

¹ *BitTorrent: Attempt #1 auf beiden Seiten `no-peer-joined` — Tracker-Cold-Handshake > 10s beim allerersten Kontakt. Attempts 2-10 durchgehend erfolgreich.*

### Was die Zahlen wirklich sagen

- **Trystero-Hypothese (D28) hält auf WebView2** — Nostr 10/10 mit ~22 ms Median.
- **Alle 3 Trystero-Strategien passen die Verwerf-Schwelle** — Broker-Swap ohne Rewrite funktioniert (Adapter-Interface belegt).
- **PeerJS-Cloud ist tragfähig** — ~10× langsamer als Trystero (216 ms vs 22 ms), aber weit unter dem 10 s-Timeout. Bleibt Backup-Kandidat trotz Single-Broker-SPOF.
- **Median ist warm, nicht cold.** Attempt #1 (echter Cold-Start): Nostr 1.3 s, MQTT 1.4 s, BitTorrent 1.1 s, PeerJS 0.7 s. Attempts 2-10 nutzen offen bleibende Relay-WebSocket → 20-215 ms. Realistischer User-Cold-Start = **~0.7–1.4 s**, nicht der Median.

### Empfehlung an D28 (Windows-Only, Stand: Remote noch offen)

**Trystero + Nostr bleibt Primär-Wahl** (10/10, ~1.3 s cold, ~20 ms warm). Strategie-Fallback-Kette (Nostr → MQTT → BitTorrent) empirisch belegt: alle drei liefern. PeerJS als 2nd-tier-Broker möglich, aber SPOF gegen Trystero-Vielfalt kein Argument mehr — Trystero ist gleich schnell und resilienter.

**Endgültige Freigabe erst nach Remote-Zeile** — NAT-Traversal-Verhalten (harte NATs, Symmetric-NAT-Tail ~10–20 %) muss noch mit 2 Geräten in verschiedenen Netzen gefahren werden.

### Produkt-Übergang: 2-Schichten-Namespacing (für M10-S11/S12)

Der Spike verwendet hart verdrahtete `appId='wbx-m10-signaling-spike'` als Broker-Namespace — für Bench-Zwecke ok (Kollision statistisch unmöglich), im Produkt aber unzureichend: zwei DM-Installationen die zufällig dieselbe Campaign „Session 1" nennen würden im selben Broker-Raum landen.

**Zweischichtige Kennung für V1:**

1. **Fester Prefix pro Rechner** (im Einladungscode codiert):
   - `salt(App + Version + Rechner-Fingerprint)` — deterministisch pro Installation, unguessable von außen (nicht der Klartext-Fingerprint).
   - Landet als opaquer Teil im Einladungscode (M10-S05).
   - Isoliert Installationen ohne die Identität preiszugeben.

2. **Room-ID = Campaign-Name** (frei wählbar vom DM):
   - Beliebiges Wort (z. B. „CurseOfStrahd", „Kampagne1").
   - Menschenlesbar, kollidiert innerhalb einer Installation nicht mit sich selbst.

**Effektive Broker-Kennung** = `hash(prefix + roomId)`, z. B. Trystero: `joinRoom({ appId: <salted-prefix> }, <campaignName>)`. Das `SignalingAdapter`-Interface bekommt `appId` als **Parameter**, nicht hart verdrahtet — der Namespace-Layer sitzt eine Ebene über dem Adapter, adapterunabhängig.

**Konsequenz für M10-S05 (Einladungscode-Format):** Code trägt bisher nur Session/Campaign-Referenz — der opaque Prefix kommt neu dazu.

**Konsequenz für PeerJS-Adapter:** PeerJS-Cloud hat keinen appId-Namespace, sondern nur rohe Peer-IDs. Deshalb muss der salted Prefix DORT direkt in die Peer-ID einfließen: `<salted-prefix>-<campaign>-<peerLabel>`. Ohne diesen Zusatz-Namespace kollidiert PeerJS-Cloud-Nutzung mit anderen Anwendungen auf dem geteilten Public-Server.
