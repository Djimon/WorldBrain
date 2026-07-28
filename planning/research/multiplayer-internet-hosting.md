# Research: Internet-Multiplayer ohne eigene Infrastruktur (M10 Stufe 3)

**Frage (User):** Können wir Multiplayer wie alte Spiele (Age of Empires, Cities Skylines) machen —
der Host öffnet den Server auf seinem eigenen PC, andere joinen mit Passwort — **ohne dass WIR eigene
Infrastruktur-Server bereitstellen müssen** (Kostenfrage wegen Kommerzialisierung)?

**Antwort: Ja, im Kern stimmt die Wette.** Der Server spawnt auf dem Host-PC („Listen Server"). Für
Internet-Spiel braucht man höchstens einen **winzigen, oft kostenlosen** NAT-Helfer — keinen
Game-State-Backend pro Nutzer. Das einzige, was echtes Geld kosten *kann*, ist ein Relay-Fallback für
die ~10–20 % Fälle, in denen der direkte Durchstich scheitert — und selbst der ist gratis lösbar.

## Das Modell: „Listen Server" (Host = Spieler + Server)

Wer die Session hostet, dessen Maschine ist der autoritative Server; andere verbinden sich dorthin. Genau
das M10-Stufe-2-Modell (LAN), nur über Internet erweitert. Listen-Server nutzen „NAT-Punch + Relay-Fallback,
weil es die Kosten niedrig hält und trotzdem jeden joinen lässt" (Unity-Doku).

## Drei Verbindungs-Szenarien

1. **LAN (gleiches WLAN)** — trivial, **null Infrastruktur.** Host bindet einen Port, Spieler verbinden über
   die LAN-IP. = M10 Stufe 2, schon spezifiziert.
2. **Internet, klassisch (Port-Forwarding / UPnP)** — der Host öffnet einen Port am Router (manuell oder
   automatisch via **UPnP**) und teilt seine öffentliche IP:Port. **So hat Age of Empires III es gemacht**
   (P2P, alle forwarden Ports 2300–2310). **Null Infrastruktur**, aber nutzerfeindlich (Router-Config, UPnP flaky).
3. **Internet, modern (NAT-Hole-Punching via STUN)** — beide Seiten fragen einen **STUN-Server** nach ihrer
   öffentlichen IP:Port und „stanzen" eine direkte Verbindung durch — **ohne Port-Forwarding**. STUN ist
   winzig, zustandslos, **billig/gratis** (öffentliche existieren; selbst hosten via coturn kostet fast nichts).
   Funktioniert für die meisten NAT-Typen (full-cone, port-restricted).
   - **Fallback TURN-Relay:** nur wenn der Durchstich scheitert (**symmetrisches NAT**, ~10–20 %). TURN leitet
     *allen* Traffic weiter → kostet Bandbreite. **Das ist der einzige Teil, der Geld kostet** — und nur für eine Minderheit.

## Die „kein eigenes Infra"-Wege (relevant für Kommerzialisierung)

- **UPnP-Auto-Port-Forward** → **null Infrastruktur**, Host-PC ist der Server. Nachteil: UPnP oft
  deaktiviert/unzuverlässig, Sicherheitsbedenken.
- **Serverloses Signaling (Connection-Code copy-paste)** → bei WebRTC tauschen die zwei Peers ihre
  Verbindungsinfo per **kopiertem Code** (DM schickt dem Spieler einen „Beitritts-String"). **Kein
  Signaling-Server.** Clunky, aber null Infra.
- **Gratis-Relay: Epic Online Services (EOS)** → **kostenloser** Relay + NAT-Traversal + Lobbies, von Indies
  genutzt. „Der EOS-Relay erlaubt Hosts, ohne externe IP vom Provider und ohne Port-Forwarding zu
  arbeiten." → **null eigene Infra, gratis**, deckt auch den symmetrischen-NAT-Fallback. Trade: Abhängigkeit
  von Epics Dienst + deren Terms.
- **Öffentliches/selbst gehostetes STUN** → Googles Public-STUN für Demos; für Produktion **coturn**
  (freie Open-Source-STUN/TURN) auf einem kleinen VPS (Cent-Beträge).

## Technische Bausteine (passend für Tauri/Rust-Desktop)

- **WebRTC Data Channels** — P2P-Austausch beliebiger Daten, ideal für unser Session-Protokoll; nutzt
  ICE/STUN/TURN unter der Haube. `libdatachannel` (schlanke C/C++-Lib) passt zu Rust/Tauri.
- **STUN** = öffentliche IP entdecken (gratis/billig, zustandslos).
- **TURN** (coturn, frei) = Relay-Fallback (nur Bandbreiten-Kosten).
- **Signaling** = winziger Austausch der Connection-Info; minimaler Server ODER manueller Code (serverlos).

## Bezug zu M10

- **Stufe 2 (LAN) ist bereits korrekt** und braucht null Infrastruktur.
- **Stufe 3 (Internet)** kann — dank M10 **Decision 1 (Transport abstrahiert)** — jede der obigen Optionen
  ohne Service-Rewrite adoptieren. Empfohlene Reihenfolge nach Kosten/Aufwand:
  1. **UPnP-Port-Forward** (null Infra, einfachster Einstieg, Host-PC = Server).
  2. **WebRTC + freies STUN + minimales/serverloses Signaling** (glatter, near-zero Infra).
  3. **EOS-Free-Relay** (null eigene Infra, gratis, deckt symmetrisches NAT) — falls die EOS-Abhängigkeit ok ist.
  4. **Selbst gehostetes coturn** (kleiner VPS) — nur wenn volle Kontrolle über den Relay gewünscht.
- **Fazit:** Kommerzialisierung erzwingt **keinen** bezahlten Backend. Der Host-PC ist der Server; die
  NAT-Traversal-Helfer sind gratis/billig, und ein Relay braucht's nur als Minderheiten-Fallback (gratis via EOS).

## Sources

- Unity — Listen server / host architecture: https://docs-multiplayer.unity3d.com/netcode/1.1.0/learn/listen-server-host-architecture/index.html
- NAT Hole Punching (UDP): https://oneuptime.com/blog/post/2026-03-20-udp-hole-punching-nat/view
- NAT traversal Überblick: https://pinggy.io/blog/how_nat_traversal_works/
- Age of Empires III P2P + Port-Forwarding: https://portforward.com/age-of-empires-iii/
- WebRTC DataChannel Multiplayer: https://webrtchacks.com/datachannel-multiplayer-game/
- WebRTC/ICE/STUN/TURN Deep Dive: https://akashsahani2001.medium.com/building-real-time-p2p-communication-a-deep-dive-into-webrtc-ice-stun-and-turn-e645492230c5
- EOS free relay (itch devlog): https://itch.io/devlog/307452/v071-relay-using-epic-online-services.amp
