# Spike: Hidden/Off-screen-Wiedergabe von YouTube-/Spotify-Embeds in Tauri-WebView

Follow-up zu `audio-youtube-tauri-spike.md` / `audio-spotify-tauri-spike.md`. Beide Docs hatten den
Player **sichtbar** getestet, obwohl die S10/S13-AC explizit "hidden/offscreen (audio-only use)"
verlangt (Player sitzen im Soundboard-Fenster, aber unsichtbar). Offene Frage: drosselt/pausiert
Chromium/WebView2 Video-/IFrame-Wiedergabe, wenn der Container versteckt wird?

**Ergebnis: WORKS, keine Einschraenkung.** Alle drei ueblichen Hide-Techniken lassen Audio
ununterbrochen weiterlaufen.

## Testaufbau

Wegwerf-HTML (`public/_spike_hidden_audio.html`, nach dem Test entfernt), im echten Tauri-Dev-Fenster
(User-Agent bestaetigt `Edg/150` = WebView2). Beide Player (YouTube IFrame API + Spotify Embed IFrame
API) gleichzeitig auf derselben Seite, Wrapper-`<div>` per Button zwischen drei Modi umgeschaltet,
waehrend das Status-Log selbst immer sichtbar blieb:

- `position: absolute; left/top: -9999px` (off-screen)
- `visibility: hidden`
- `display: none`

## Befund

```
=== YT wrapper mode -> hide-offscreen ===
=== SP wrapper mode -> hide-offscreen ===
=== YT wrapper mode -> hide-displaynone ===
=== SP wrapper mode -> hide-displaynone ===
Spotify playback_update: position=999 isPaused=false
Spotify playback_update: position=2059 isPaused=false
Spotify playback_update: position=3123 isPaused=false
...
Spotify playback_update: position=6328 isPaused=false
=== SP wrapper mode -> hide-displaynone ===
=== SP wrapper mode -> hide-visibility ===
Spotify playback_update: position=7388 isPaused=false
=== SP wrapper mode -> visible ===
Spotify playback_update: position=8450 isPaused=false
```

Nutzerbeobachtung (hoerbar, ueber den gesamten Testlauf): **"hat die ganze Zeit weiter gespielt, egal
ob sichtbar oder nicht."** `position` steigt in Spotifys `playback_update` durchgehend weiter — auch
waehrend `display: none` aktiv war (der staerkste der drei Hide-Modi, da er bei anderen Engines
gelegentlich Medien-Elemente pausiert/throttled). Kein Abbruch, kein `isPaused: true` durch das
Verstecken selbst (das einzige `isPaused: true` am Ende kam von einem manuellen Pause-Klick, nicht vom
Hide-Toggle).

## Go/No-Go

**GO — keine Einschraenkung fuer S10/S13.** Alle drei Hide-Techniken sind in Tauris WebView2 sicher;
`display: none` ist die einfachste und wird empfohlen (kein Off-screen-Hack mit negativen Koordinaten
noetig, kein Layout-Sonderfall). Der in `audio-youtube-tauri-spike.md` offen gelassene Caveat ("ob
hidden/offscreen genauso zuverlaessig weiterspielt wie sichtbar") ist damit geklaert: ja.
