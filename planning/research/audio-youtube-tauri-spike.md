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

## Nicht in diesem Durchlauf verifiziert (kein Blocker, aber offen für S13)

- `setVolume(0..100)`-Rampe (Basis für Fade) — UI-Regler war vorhanden, wurde in diesem Durchlauf nicht bestätigt geklickt.
- Playlist-URL als eine durchgehende Quelle (`loadPlaylist`) — Button vorhanden, nicht bestätigt getestet.

Beides ist Standard-IFrame-API-Funktionalität ohne embeddingsspezifisches Risiko — Empfehlung: bei S13-Implementierung direkt mitverifizieren, kein separater Spike nötig.

## Go/No-Go

**GO.** YouTube-Tier (S13, #284) kann wie geplant gebaut werden. Kein Re-Scoping nötig.
