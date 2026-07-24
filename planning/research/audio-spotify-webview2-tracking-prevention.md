> **Nachtrag 2026-07-24 (nach diesem Research):** Die Empfehlung unten ("nicht implementieren") beruhte auf
> der Annahme, Tracking Prevention / Spotifys Embed-Unzuverlässigkeit sei die Ursache der Stille — das war
> **falsch**. User-Bisection zeigte einen echten Code-Regression in `82ef6ea`: Spotifys `createController()`
> fügt sein Iframe mit `loading="lazy"` ein; der damalige Crash-Fix beließ den `display:none`-Container als
> dauerhaften Wrapper, wodurch das Iframe nie die Lazy-Load-Schwelle erreicht und für immer auf `about:blank`
> hängen blieb. Gefixt in `src/ui/SpotifyClipPlayer.tsx` (erzwingt `loading='eager'`), siehe D9 in
> `M15-audio-soundboard-panel.md`. Tracking Prevention selbst bleibt ein **unbestätigtes** Restrisiko für
> Volltrack-vs-Preview-Zuverlässigkeit — die Analyse dazu (Abschnitte 1–5 unten) bleibt technisch gültig,
> nur die Schlussfolgerung "das ist die Ursache der Stille" war es nicht.

# Research: WebView2 Tracking Prevention & der Spotify-Tier (Follow-up zu #280 / audio-spotify-tauri-spike.md)

**Frage/Problem:** Der Spotify-Embed-Tier (öffentliches IFrame-Widget, kein OAuth — siehe `audio-spotify-tauri-spike.md`) ist meistens stumm. DevTools zeigt ~194x:

```
Tracking Prevention blocked access to storage for <URL>.
```

Bestätigt (via WebSearch/WebFetch gegen Microsofts eigene Doku, diese Session): WebView2 hat Tracking Prevention standardmäßig aktiv (Level `Balanced`), blockiert Storage-/Cookie-Zugriff für als Tracker klassifizierte Origins — vermutlich inkl. `open.spotify.com` im IFrame-Kontext. Offen war: gibt es einen Rust/Tauri/wry-Hebel dagegen, und ist TP überhaupt die eigentliche Ursache oder ein Red Herring?

**Projekt-Versionen (aus `src-tauri/Cargo.lock`):** `tauri 2.11.3`, `wry 0.55.1`, `webview2-com 0.38.2`, `webview2-com-sys 0.38.2`.

## Befund

### 1. Exponiert `wry` 0.55.1 einen Hook für WebView2-Environment-Optionen / Tracking Prevention?

**Teilweise — nicht direkt, aber über einen validen Umweg.** Quelle: `crates/bindings/src/lib.rs` (Windows-Sektion) im [wry-Repo](https://github.com/tauri-apps/wry/blob/dev/src/lib.rs).

`WebViewBuilderExtWindows` (Windows-only Trait) exponiert:
- `with_additional_browser_args(&str)` — nur Chromium-Kommandozeilen-Flags (`AdditionalBrowserArguments`), **kein** Zugriff auf `EnableTrackingPrevention` (das ist ein Environment-*Options*-Property, kein CLI-Flag — bestätigt keine Brücke vorhanden).
- `with_browser_extensions_enabled(bool)`
- `with_environment(environment: ICoreWebView2Environment)` — **das ist der eigentliche Hebel:** wry lässt die App ein *bereits fertig konstruiertes* `ICoreWebView2Environment` reinreichen, statt es selbst zu bauen. Das bedeutet: die App könnte über die `webview2-com`-Crate (bereits transitive Dependency von wry) selbst `CoreWebView2EnvironmentOptions` bauen, `set_enable_tracking_prevention(false)` setzen und `CreateCoreWebView2EnvironmentWithOptions` aufrufen — und das fertige Environment via `with_environment()` an wry übergeben.
- `with_profile_name(&str)` — WebView2-Multi-Profile-Support (isolierte Cookies/Storage pro Profilname), betrifft NICHT direkt Tracking Prevention, aber Storage-Isolation.
- `WebViewExtWindows::environment(&self) -> ICoreWebView2Environment` — Zugriff auf das Environment eines bereits erstellten WebView.

**Praktisches Problem:** `with_environment()` ist eine Methode auf wrys `WebViewBuilder`, nicht auf Tauris öffentlicher `WebviewWindowBuilder`-API. Tauri baut das Environment intern beim Fenster-Setup; es gibt (soweit recherchiert) keinen Tauri-Config- oder Builder-Pfad, der Tauri anweist, ein von der App vorkonstruiertes `ICoreWebView2Environment` zu verwenden. D.h. dieser Weg wäre nur nutzbar, wenn man wry direkt statt Tauris Runtime-Abstraktion ansteuert — für ein Tauri-v2-Projekt unrealistisch invasiv.

**`CoreWebView2EnvironmentOptions` selbst existiert und funktioniert** (Quelle: [`crates/webview2-com/src/options.rs`](https://github.com/wravery/webview2-rs/blob/main/crates/webview2-com/src/options.rs), implementiert `ICoreWebView2EnvironmentOptions5` inkl. `enable_tracking_prevention()`/`set_enable_tracking_prevention()`, Default = `true` — bestätigt Microsofts Doku, dass TP ab Werk an ist).

### 2. Tauri v2 Escape Hatch für rohen COM-Zugriff — `PlatformWebview`

**Ja, und das ist der praktikablere Weg.** `tauri::webview::PlatformWebview` (Windows) exponiert (Quelle: docs.rs, Windows-Target):

```rust
pub fn controller(&self) -> ICoreWebView2Controller
pub fn environment(&self) -> ICoreWebView2Environment
```

Von `ICoreWebView2Controller` aus ist die volle COM-Kette erreichbar (bestätigt per Grep gegen die generierten `webview2-com-sys`-Bindings, `bindings.rs`, die exakten Typen hinter `tauri`/`wry`):

```
ICoreWebView2Controller::CoreWebView2() -> ICoreWebView2      // bindings.rs:9294
ICoreWebView2::Profile() -> ICoreWebView2Profile              // bindings.rs:40291 (über ICoreWebView2_13-Kette)
ICoreWebView2Profile → cast → ICoreWebView2Profile3
ICoreWebView2Profile3::SetPreferredTrackingPreventionLevel(COREWEBVIEW2_TRACKING_PREVENTION_LEVEL_NONE)
```

`COREWEBVIEW2_TRACKING_PREVENTION_LEVEL` (Enum, bindings.rs:875-883): `NONE=0`, `BASIC=1`, `BALANCED=2` (Default), `STRICT=3` — alle vier Werte sind in den Bindings vorhanden, `ICoreWebView2Profile3` ist seit SDK `1.0.1661.34` stabil (uralt, sicher in 0.38.2 enthalten — per Grep direkt verifiziert, nicht nur aus SDK-Datum abgeleitet).

Wichtiger Punkt aus Microsofts eigener Doku ([ICoreWebView2Profile3](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2profile3)): *"If tracking prevention feature is enabled when creating the WebView2 environment, you can also disable tracking prevention later using this property [...] but that doesn't improve runtime performance."* — d.h. man muss NICHT die Environment-Erstellung abfangen; ein `put_PreferredTrackingPreventionLevel(NONE)` **nach** dem Erstellen des Webviews (z.B. im Tauri `setup`-Hook oder `on_webview_ready`) reicht funktional aus, nur ohne den Performance-Vorteil des Deaktivierens vor der Environment-Erstellung.

**Fazit Q1+Q2:** Ein Rust-seitiger Fix ist technisch machbar, aber nicht "eine Zeile Config" — es braucht:
- direkten `windows`/`webview2-com`-Crate-Zugriff im App-Code (COM-Interface-Casts, `unsafe`),
- den `PlatformWebview`-Escape-Hatch von Tauri (verfügbar erst nach WebView-Erstellung, also im `setup`/`on-page-load`-Hook, nicht deklarativ in `tauri.conf.json`),
- Wissen, dass `EnableTrackingPrevention` NICHT über `additionalBrowserArguments` erreichbar ist (bestätigt kein Config-Only-Fix).

### 3. Community-Workarounds

Keine Tauri/wry-spezifischen Threads zu "Tracking Prevention" gefunden (GitHub-Suche in `tauri-apps/wry` und `tauri-apps/tauri` liefert keine Treffer). Das generische WebView2-Problem ist dokumentiert in [MicrosoftEdge/WebView2Feedback#842](https://github.com/MicrosoftEdge/WebView2Feedback/issues/842) (Bing-Maps-IFrame, migriert von CEF) — dort spekuliert der Reporter selbst über `AdditionalBrowserArguments`-Flags, findet aber **keine funktionierende Lösung**; Microsoft markiert den Issue nur als "tracked"/"feature request", ohne konkreten Fix im sichtbaren Thread-Verlauf. Kein Bericht von Erfolg mit reinen Config-/CLI-Flag-Ansätzen gefunden — deckt sich mit dem obigen Befund, dass es keinen CLI-Flag-Ersatz gibt.

### 4. `dataDirectory`/User-Data-Folder-Persistenz

Im Projekt ist aktuell **kein** `dataDirectory` in `src-tauri/tauri.conf.json` gesetzt → Tauri verwendet den Default-User-Data-Ordner (persistenter, appspezifischer Pfad, keine Temp-Ordner-Rotation zwischen Starts). D.h. das Problem ist vermutlich **nicht** "Profil wird bei jedem Start neu angelegt".

Wichtiger von Microsoft bestätigter Punkt: `PreferredTrackingPreventionLevel` **wird im User-Data-Folder persistiert** — sprich, würde man den Level einmal per COM-Call auf `NONE` setzen, bliebe das über Neustarts hinweg bestehen (bei stabilem `dataDirectory`, was hier bereits der Fall ist). Tracking Prevention selbst ist aber eine **Pro-Request-Klassifizierung** (Tracking Protection Lists), keine Funktion der Storage-Persistenz — ein instabiler Datenordner würde das TP-Blocking-Verhalten selbst nicht auslösen oder verschlimmern. Die "funktioniert einmal, dann nicht mehr"-Beobachtung ist mit hoher Wahrscheinlichkeit **kein** `dataDirectory`-Problem, sondern deckt sich mit dem nächsten Punkt (Spotify-Embed selbst ist unzuverlässig, unabhängig vom Storage-Zustand).

### 5. Erfordert Spotifys öffentliches Embed wirklich einen Login — oder ist "Storage blocked" ein Red Herring?

**Bestätigt: echtes Login-Erfordernis, UND bekanntes Spotify-seitiges Flackern — beides zusammen erklärt das Symptom besser als reine Tracking Prevention.**

Aus mehreren Spotify-Community-Threads (developer.spotify.com-Forum, via WebSearch)://
- *"It will only work on desktop if you are logged in with your Spotify Premium account at the browser. That's intended behavior."*
- *"The embedded player is supposed to show the full song when you're logged in [...] however most of the time it shows only a preview, as if you hadn't logged in"* — d.h. **selbst mit aktivem Login ist Vollwiedergabe im Embed unzuverlässig**, in normalen Desktop-Browsern, ganz ohne WebView2 im Spiel.
- Ein separater Thread beschreibt exakt das gleiche Problem in einer Electron-App (`"Unable to embed full spotify song on Electron App"`) — bestätigt, dass das Problem nicht WebView2-spezifisch ist, sondern generisch bei jedem eingebetteten Chromium-Kontext ohne "echten" eingeloggten Spotify-Browser-Session auftritt.

**Einordnung:** In der Tauri-WebView gab es nie eine Gelegenheit, sich bei Spotify einzuloggen (kein sichtbarer Login-Flow im Soundboard-Feature) — der IFrame läuft technisch immer im "ausgeloggt"-Zustand. Tracking Prevention verschärft das zusätzlich (blockiert ggf. Storage, die Spotify für Session-/Consent-State bräuchte), ist aber vermutlich nicht die alleinige Ursache — selbst mit TP=NONE bliebe das Embed ohne Login großteils auf 30s-Preview limitiert. Die 194 TP-Log-Zeilen sind wahrscheinlich zu großen Teilen Rauschen von Spotifys eigenen Tracking-/Analytics-Calls (nicht zwingend das eigentliche Audio-Streaming), was auch erklärt, warum Playback in einem früheren Spike-Lauf trotz TP-Meldungen zeitweise durchlief (`audio-spotify-tauri-spike.md`: *"Playback lief > 9s ohne Preview-Abbruch"*).

## Empfehlung

**Nicht implementieren — als bekannte Desktop-Limitation dokumentieren, nicht weiter verfolgen.**

Begründung:
1. Der Spotify-Tier ist bereits explizit "nicht V1" (`M15-audio-soundboard-panel.md`), verschoben bis nach dem YouTube-Tier — dieser Research-Auftrag bestätigt nur eine bereits getroffene Entscheidung, schafft keinen neuen Scope.
2. Selbst ein funktionierender TP-Fix (`PlatformWebview` → COM-Cast → `SetPreferredTrackingPreventionLevel(NONE)`) behebt nur einen Teil des Problems. Der öffentliche Spotify-Embed hat ohnehin **kein** `setVolume()` (bereits in `audio-spotify-tauri-spike.md` bestätigt — "zero signal access") und laut Community-Reports selbst mit Login unzuverlässige Vollwiedergabe. Der Aufwand (unsafe COM-Interop, App-seitige `windows`/`webview2-com`-Dependency, Wartungslast bei WebView2-SDK-Updates) steht in keinem Verhältnis zum Ergebnis: bestenfalls ein Tier, der weiterhin keine Lautstärke-/Fade-Kontrolle hat und bei dem Vollwiedergabe weiterhin fragil bleibt.
3. Der im Epic bereits skizzierte "richtige" Weg für echten Signalzugriff (Spotify Web Playback SDK, OAuth + Premium) umgeht dieses ganze Problem strukturell anders (eigener Login-Flow innerhalb der App, echte Session) — sollte der Spotify-Tier je reaktiviert werden, ist das der sinnvollere Ansatz, nicht ein Tracking-Prevention-Hack um das kaputte Embed-Widget herum.
4. Sollte das Feature später als "echter Webapp-Port" (Browser statt Tauri-Desktop) erscheinen, entfällt das gesamte WebView2-spezifische Problem ohnehin (normale Browser-Tabs haben eigene, oft bereits eingeloggte Spotify-Sessions und andere/keine Tracking-Prevention-Defaults) — ein jetzt gebauter Workaround wäre Wegwerf-Code für eine Plattform, die eventuell verlassen wird.

**Wenn der Spotify-Embed-Tier doch reaktiviert wird** (z.B. als Nice-to-have vor dem Web Playback SDK): der technische Pfad ist dokumentiert (Abschnitt 2 oben) und mit vertretbarem Aufwand (~1 Funktions-Aufruf-Kette in `setup`/`on_webview_ready`, kein Config-Change) umsetzbar — dann lohnt sich der Versuch. Bis dahin: kein Rust-Code anfassen, keine `additionalBrowserArguments`-Sackgasse verfolgen (bestätigt wirkungslos für TP).

## Sources

- [WebView2Feedback: TrackingPrevention.md spec](https://github.com/MicrosoftEdge/WebView2Feedback/blob/main/specs/TrackingPrevention.md)
- [WebView2Feedback#842: Tracking Prevention blocked access to storage](https://github.com/MicrosoftEdge/WebView2Feedback/issues/842)
- [ICoreWebView2Profile3 (Microsoft Learn)](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2profile3)
- [wry `src/lib.rs` — `WebViewBuilderExtWindows`/`WebViewExtWindows`](https://github.com/tauri-apps/wry/blob/dev/src/lib.rs)
- [webview2-com `crates/webview2-com/src/options.rs` — `CoreWebView2EnvironmentOptions`](https://github.com/wravery/webview2-rs/blob/main/crates/webview2-com/src/options.rs)
- [webview2-com-sys generated bindings (`ICoreWebView2Profile3`, `COREWEBVIEW2_TRACKING_PREVENTION_LEVEL`)](https://raw.githubusercontent.com/wravery/webview2-rs/main/crates/bindings/src/bindings.rs)
- [`tauri::webview::PlatformWebview` (docs.rs, Windows target)](https://docs.rs/tauri/2.11.3/x86_64-pc-windows-msvc/tauri/webview/struct.PlatformWebview.html)
- Spotify Developer Community: *"30 second preview showing when try to embed playlist"*, *"Unable to embed full spotify song on Electron App"*, *"Spotify Track Embed not signing in (Firefox)"* (community.spotify.com, t5/Spotify-for-Developers)
- `H:\AIProjects\WorldBuilderX\src-tauri\Cargo.lock` (Versions-Pins: `tauri 2.11.3`, `wry 0.55.1`, `webview2-com(-sys) 0.38.2`)
