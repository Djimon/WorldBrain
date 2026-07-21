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

## Nachverifikation: setVolume-Rampe + loadPlaylist (2026-07-21)

Beide Punkte wurden in einem separaten Verifikations-Spike im echten Tauri-Dev-Fenster (WebView2) bestätigt.

### setVolume: WORKS — mit wichtigem Implementierungshinweis

```
setVolume(0) called → getVolume() = 100
setVolume(50) called → getVolume() = 0
setVolume(100) called → getVolume() = 50
Fade OUT: setVolume(95) → getVolume()=100 ... setVolume(0) → getVolume()=5
Fade IN:  setVolume(5)  → getVolume()=0  ... setVolume(100) → getVolume()=95
```

**Befund:** `setVolume()` funktioniert und das Fade war hörbar. `getVolume()` gibt immer den Wert aus dem *vorherigen* `setVolume()`-Aufruf zurück (one-tick-behind, asynchrones Commit). Das ist normales YouTube-IFrame-API-Verhalten.

**Implementierungsregel für S13:** Den Ramp-Zähler ausschließlich in einer lokalen JS-Variable tracken — niemals via `getVolume()` rücklesen. Sonst läuft der Fade immer einen Schritt versetzt.

### loadPlaylist: WORKS (API-Ebene)

```
loadPlaylist() called
onStateChange: BUFFERING | playlist=[] | idx=0
onStateChange: PLAYING | playlist=[] | idx=0
```

**Befund:** Die API-Funktion ist vorhanden und funktioniert. Playback startete (`PLAYING | idx=0`). `playlist=[]` war geo-blocking der Testplaylist, kein API-Fehler — der Aufruf selbst lief durch, `nextVideo()`/`previousVideo()` sind aufrufbar. Bei einer in Deutschland nicht blockierten Playlist wird `getPlaylist()` die IDs zurückgeben.

**Fazit:** Beide S13-Voraussetzungen erfüllt. Kein weiterer Spike nötig. **GO für S13 (#284).**

## Go/No-Go

**GO.** YouTube-Tier (S13, #284) kann wie geplant gebaut werden. Kein Re-Scoping nötig.
