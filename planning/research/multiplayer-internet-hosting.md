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
- **Gratis-Relay: Epic Online Services (EOS)** → technisch ideal (kostenloser Relay + NAT-Traversal +
  Lobbies, deckt symmetrisches NAT). **⚠️ ABER: EOS-ToS beschränkt auf „video games and game-related
  applications" — „not for applications not related to video games."** WorldBuilderX ist ein
  Kreativ-/Vorbereitungs-Tool, kein Video-Game → **wahrscheinlich NICHT lizenzberechtigt** (Grauzone
  „game-related" höchstens). Für ein kommerzielles Produkt zu riskant (Epic kann Zugang kündigen →
  Multiplayer tot; GameSpy-Lehre + ToS-Risiko). **EOS daher raus.** Quelle: https://onlineservices.epicgames.com/licensing
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
- **LAN zuerst, NICHT skippen.** Dank M10 **Decision 1 (Transport abstrahiert)** ist „LAN vs. Internet" kein
  Entweder-oder. LAN ist der **billigste erste Transport**, um die Session-Maschinerie (Join/Approve/
  Visibility/Live-Updates) zu bauen und zu testen — ohne Accounts, NAT, Internet — **und** bleibt als
  Null-Abhängigkeits-Fallback (am Tisch/offline). Erst Session-Logik transport-agnostisch über LAN grün
  kriegen, dann den Internet-Transport dazu.
- **Stufe 3 (Internet) — lizenzfreie Reihenfolge** (EOS raus, s.o.):
  1. **WebRTC + freies STUN** → ~80–90 % verbinden per Hole-Punching, **null eigene Infra**; Signaling minimal
     oder serverlos (Einladungscode). Anwender konfiguriert **nichts** am Router.
  2. **Selbst gehostetes coturn (freie Open-Source-TURN)** auf einem Cent-VPS → Fallback für die ~10–20 %
     symmetrischen NATs. Der **einzige** kleine Kostenpunkt, und optional (ohne TURN fällt nur die Minderheit raus).
  3. **UPnP-Port-Forward** als zusätzliche Direkt-Option (null Infra), wo verfügbar.
- **Fazit:** Kommerzialisierung erzwingt **keinen** bezahlten Backend. Der Host-PC ist der Server; STUN ist
  gratis, coturn kostet Cent-Beträge nur für den Minderheiten-Fallback. **EOS wäre technisch ideal, ist aber
  für ein Nicht-Video-Game laut ToS nicht nutzbar** — daher der WebRTC/coturn-Weg.

## Sources

- Unity — Listen server / host architecture: https://docs-multiplayer.unity3d.com/netcode/1.1.0/learn/listen-server-host-architecture/index.html
- NAT Hole Punching (UDP): https://oneuptime.com/blog/post/2026-03-20-udp-hole-punching-nat/view
- NAT traversal Überblick: https://pinggy.io/blog/how_nat_traversal_works/
- Age of Empires III P2P + Port-Forwarding: https://portforward.com/age-of-empires-iii/
- WebRTC DataChannel Multiplayer: https://webrtchacks.com/datachannel-multiplayer-game/
- WebRTC/ICE/STUN/TURN Deep Dive: https://akashsahani2001.medium.com/building-real-time-p2p-communication-a-deep-dive-into-webrtc-ice-stun-and-turn-e645492230c5
- EOS free relay (itch devlog): https://itch.io/devlog/307452/v071-relay-using-epic-online-services.amp
