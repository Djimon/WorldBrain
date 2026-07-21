# Spike: YouTube-IFrame in Tauri-WebView (#280)

**Frage:** Kann ein YouTube-IFrame-Player innerhalb der Tauri v2 WebView (Windows WebView2) eingebettet und gesteuert werden?

**Ergebnis: WORKS.** Kein Blocker gefunden. **Go für S13 (#284).**

**Update:** Hidden/off-screen-Wiedergabe (S10/S13-AC: "audio-only, hidden/offscreen") separat verifiziert — siehe `audio-hidden-playback-tauri-spike.md`. Auch da: WORKS.

## Testaufbau

Wegwerf-HTML (`public/_spike_youtube.html`, nach dem Test entfernt — nicht produktiv), geladen im echten Tauri-Dev-Fenster (`npm run desktop:dev`, `devUrl` temporär auf die Spike-Seite gesetzt). YouTube IFrame Player API (`https://www.youtube.com/iframe_api`) gegen ein bekannt einbettbares öffentliches Video (`dQw4w9WgXcQ`).

## Befund (User-Agent bestätigt echte WebView2-Instanz: `... Edg/150.0.0.0`)

```
YT IFrame API: loading…
YT IFrame API: ready
onReady fired
playVideo() called (unmuted autoplay attempt)
onStateChange: PLAYING
AUTOPLAY (unmuted) RESULT: succeeded (state=PLAYING without prior user click)
manual pauseVideo() clicked
onStateChange: PAUSED
manual playVideo() clicked
onStateChange: BUFFERING
onStateChange: PLAYING
manual pauseVideo() clicked
onStateChange: PAUSED
```

- **Laden + Audio:** IFrame API lädt, Player rendert, Video spielt. Kein `onError`, keine Referrer-/Origin-Fehler in der Konsole.
- **Autoplay-Policy:** Unmuted `playVideo()` direkt nach `onReady` **ist sofort auf `PLAYING` gesprungen** — ohne vorherige User-Geste. WebView2 blockiert unmuted Autoplay hier NICHT so restriktiv wie ein Standard-Chrome-Tab (dort wäre i.d.R. ein Mute nötig oder ein Media-Engagement-Score). Kein Autoplay-Overlay/`can-autoplay`-Workaround nötig.
- **Play/Pause-Steuerung:** Sauberer State-Übergang PLAYING → PAUSED → BUFFERING → PLAYING → PAUSED über `playVideo()`/`pauseVideo()`.
- **Config:** Keine `tauri.conf.json`-CSP-Anpassung nötig — aktuell `"csp": null` (keine Restriktion). Falls das Projekt später eine CSP einzieht, muss `frame-src`/`connect-src` youtube.com/youtube-nocookie.com/ytimg.com erlauben (noch nicht getestet, da aktuell keine CSP aktiv ist).

## Noch unverifiziiert — MUSS bei S13-Implementierung bestätigt werden

Diese beiden Punkte sind **Implementierungs-Voraussetzungen**, nicht optionale Nice-to-haves. S13 (#284) darf den Fade/Volume-Ramp und die Playlist-Integration NICHT als fertig abschliessen, bevor sie live im Tauri-Dev-Fenster bestätigt sind:

- **`setVolume(0..100)`-Rampe:** Das ist die einzige Basis für Fade-In/Out (D2). War im Spike-UI vorhanden, aber nicht manuell ausgelöst. Risiko: falls das IFrame-API-`setVolume` in WebView2 stille Fehler wirft oder die Lautstärke nicht korrekt skaliert, bricht das gesamte Fade-Konzept. → Bei der S13-Implementierung: `setVolume` explizit von 0 auf 100 und zurück rampen und Lautstärkeänderung hörbar bestätigen.

- **Playlist-als-eine-Quelle (`loadPlaylist`):** Der Soundboard-Kanal soll eine YouTube-Playlist als kontinuierliche Hintergrund-Quelle abspielen (ein Track endet → nächster startet automatisch). War im Spike vorhanden, aber nicht bestätigt getestet. → Bei der S13-Implementierung: `loadPlaylist` mit einer echten Playlist-ID aufrufen, automatischen Übergang zum nächsten Track abwarten und per `onStateChange` bestätigen.

Beides ist Standard-IFrame-API — kein separater Spike nötig — aber ohne hörbare Bestätigung im Tauri-Dev-Fenster gilt der S13-AC als **nicht erfüllt**.

## Go/No-Go

**GO.** YouTube-Tier (S13, #284) kann wie geplant gebaut werden. Kein Re-Scoping nötig.
