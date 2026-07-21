# Spike: Spotify-Embed-Widget in Tauri-WebView (Follow-up zu #280)

**Frage (analog zu #280):** Laedt/steuert das offizielle, oeffentliche Spotify-Embed-Widget (kein OAuth, keine App-Registrierung) innerhalb der Tauri v2 WebView (Windows WebView2)?

**Nicht Teil von EPIC-024/M15** — der Spotify-Tier ist dort bereits explizit auf "nicht V1" verschoben (`planning/epics/M15-audio-soundboard-panel.md`: *"Spotify tier (OAuth + Premium + DRM + zero signal access) — not V1; revisit after YouTube tier proves out."*). Dieser Spike liefert die technische Grundlage, um diese Entscheidung zu bestaetigen/zu praezisieren, kein neuer Scope.

**Ergebnis: WORKS — aber mit der bereits vermuteten harten Einschraenkung (kein Signalzugriff).**

## Testaufbau

Wegwerf-HTML (`public/_spike_spotify.html`, nach dem Test entfernt — nicht produktiv), geladen im echten Tauri-Dev-Fenster. Spotifys offizielle IFrame-API (`https://open.spotify.com/embed/iframe-api/v1`) gegen eine bekannte oeffentliche Playlist (`37i9dQZF1DXcBWIGoYBM5M`, "Today's Top Hits").

## Befund (User-Agent bestätigt echte WebView2-Instanz: `... Edg/150.0.0.0`)

```
Spotify IFrame API: loading…
Spotify IFrame API: ready
createController callback fired — controller present: true
typeof controller.play = function
typeof controller.pause = function
typeof controller.togglePlay = function
typeof controller.seek = function
typeof controller.setVolume = undefined
typeof controller.loadUri = function
addListener("ready") fired
manual play() clicked
playback_update: position=0 isPaused=false isBuffering=false
playback_update: position=0 isPaused=false isBuffering=true
playback_update: position=0 isPaused=false isBuffering=false
playback_update: position=1017 isPaused=false isBuffering=false
playback_update: position=2077 isPaused=false isBuffering=false
...
manual pause() clicked
playback_update: position=9249 isPaused=true isBuffering=false
```

- **Laden + Steuerung:** IFrame-API laedt, `createController` liefert einen echten Controller. `play()`/`pause()`/`togglePlay()`/`seek()`/`loadUri()` sind vorhanden und funktionieren — `position` tickt in Echtzeit hoch, `isPaused`/`isBuffering` reagieren korrekt auf manuelle Steuerung. Keine Fehler-Events, keine Referrer-/Origin-Probleme.
- **Kein `setVolume`:** `typeof controller.setVolume` ist `undefined` — das oeffentliche Embed-Widget hat **keinen** API-Zugriff auf Lautstaerke (geschweige denn EQ/Balance). Bestaetigt exakt die im Epic bereits dokumentierte Einschraenkung ("zero signal access").
- **Playback-Umfang:** In diesem Durchlauf lief die Playlist ohne erkennbares 30-Sekunden-Preview-Limit (Position lief über 9s Testdauer weiter, kein Abbruch) — deutet auf einen eingeloggten Spotify-Kontext im Browser/System hin. Ohne aktive Spotify-Session waere vermutlich Preview-Only-Verhalten zu erwarten (nicht in diesem Durchlauf getrennt verifiziert).

## Vergleich zu YouTube (#280)

| | YouTube IFrame API | Spotify Embed IFrame API |
|---|---|---|
| Laedt in Tauri WebView2 | ✔ | ✔ |
| Play/Pause/Seek | ✔ | ✔ |
| **Volume-Kontrolle (Fade-Basis)** | ✔ `setVolume(0..100)` | ✘ nicht vorhanden |
| Balance/EQ | ✘ (kein Web-Audio-Node bei Cross-Origin-IFrame, wie im Epic dokumentiert) | ✘ (gleicher Grund + kein Volume-Hook ueberhaupt) |
| Playlist als eine Quelle | zu verifizieren (S13) | ✔ (Playlist-URI direkt geladen) |

## Go/No-Go

**Bestaetigt: Spotify-Tier bleibt zu Recht "nicht V1".** Das offizielle Embed liefert nicht einmal die minimale Fade/Volume-Kontrolle, die der YouTube-Tier (D2) hat — ein Soundboard-Kanal mit Spotify-Quelle koennte nur stumm/laut (Mute des ganzen IFrames) an/aus, kein Volume-Ramp, kein Fade. Fuer echten Signalzugriff (Volume, EQ, Crossfade) waere nur der Spotify Web Playback SDK (OAuth + Premium) denkbar — das ist der bereits im Epic vermerkte, bewusst verschobene Weg. Keine neue Erkenntnis, die den Spotify-Tier vorzieht — der Spike bestaetigt lediglich, dass auch der "einfache" Embed-Weg (ohne OAuth) am Signalzugriff scheitert, nicht nur am DRM.
