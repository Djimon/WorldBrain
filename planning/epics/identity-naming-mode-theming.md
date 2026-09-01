# EPIC: Worlds and Beyond — Produkt-Identität, Namen & Modus-Theming

## Kontext (für Leser ohne Vorwissen)

Worlds and Beyond ist eine **Tauri-v2-Desktop-App** (React + TypeScript, läuft im OS-WebView; Windows = WebView2/Chromium) zum Bauen und Bespielen von Pen-&-Paper-Rollenspielwelten. Die App hat **zwei sich gegenseitig ausschließende Shell-Modi**, zwischen denen ein globaler Top-Bar-Umschalter kippt (das „Bearbeiten ⟷ Spielen"-Toggle, geliefert im Multiplayer-Milestone „M10 - Multiplayer & Player Identity"):

- **Prep/Autor-Modus** — der Spielleiter (DM) baut die Welt allein: Entities, Karten, Timeline, Kampagnen-Struktur.
- **Live/Session-Modus** — die Gruppe bespielt die Welt am Tisch: World State, Runtime, Gruppen/Spieler, virtueller Spieltisch.

Beim Umschalten transformiert sich die ganze Shell (der Menübaum reduziert sich im Live-Modus auf die im Spiel erlaubte Teilmenge; Bearbeiten-Buttons sind rollen-gated). Zusätzlich besitzt die App eine **system-agnostische Regel-Engine** als Alleinstellungsmerkmal (sie unterstützt *beliebige* Regelsysteme statt nur eines — das grenzt sie von Konkurrenten ab, die nur ein einziges System können).

Dieser Epic gibt dem Produkt seine **sichtbare Identität**: einen Plattformnamen, je einen Marken-Namen pro Modus im Header, einen Marken-Namen für die Engine, und ein **themebares Modus-Akzentfarben-System**, das dafür sorgt, dass der DM auf einen Blick erkennt, in welchem Modus er ist — damit er **nie versehentlich im falschen Fenster etwas ändert**.

Die systematische Trennung existiert bereits im Code (world-building-Entities getrennt von campaign-scoped Runtime-Daten; die Regel-Engine als eigenes Substrat). **Neu ist nur die Identitäts-/Theming-Schicht obendrauf — keine neue Engine, kein neuer Datenfluss.**

## Goal

Der Nutzer erlebt **eine** Plattform-Marke und sieht im Header **je nach aktivem Modus** deren Namen; er unterscheidet die beiden Modi **sofort an einem Farbakzent**, der austauschbar (themebar) ist; und die Regel-Engine trägt ihren eigenen Marken-Namen dort, wo ihr USP verkauft wird. Alles darunter (Buttons, Menü, Panels) bleibt in **funktionalem Klartext** — Marke lebt nur im Header und an den Engine-Flächen.

## Decisions

1. **Namensarchitektur — drei sichtbare Ebenen:**
   - **Plattform = „Worlds and Beyond"** — die *eine* App-Marke. Erscheint in Splash, Fenstertitel, About, und als kleine, dauerhafte Kennung im Header.
   - **Zwei Modus-Marken im Header:**
     - **„RealmForge"** = der Prep/Autor-Modus.
     - **„Adventure Nexus"** = der Live/Session-Modus.
   - **Engine-Marke** = ein eigener Name für die system-agnostische Regel-Engine (der USP). **Kein** Nav-Modus, **kein** Umschalter-Eintrag. Erscheint nur an den „bring dein eigenes System"-Flächen (System-/Plugin-Manager, Onboarding „wähle/erstelle dein Regelsystem", Splash/Marketing).
   - **Firmenname** = nur Legal/Backend/Impressum, **null** UI-Fläche.

2. **Regel: Modus → Marke, NICHT Rolle → Marke.** Das Header-Label folgt dem **aktiven Modus**, nicht der Rolle der Person. Ein DM kann einer Live-Session auch als DM *mitspielen* (GM-Self-Join): sitzt er im Live-Modus, sieht er **„Adventure Nexus"**, nicht „RealmForge" — unabhängig davon, dass er DM ist. Der DM-vs-Spieler-Unterschied lebt ausschließlich in den **Rechten** (Bearbeiten-Controls rollen-gated), **nicht** im Modus-Namen. Ein Mapping „Rolle → Label" wäre falsch und bricht GM-Self-Join.

3. **Modus-Farbakzent = EIN themebares Token-Set, das der Shell-Umschalter kippt.** Beim Moduswechsel wird ein einziges Set semantischer Accent-Tokens neu belegt; alle Design-System-Primitives (`Button`, `StatusChip`, aktiver Tab, Focus-Ring, Kopf-Akzentstreifen aus `src/ui/primitives.tsx`) ziehen ihre Akzentfarbe ausschließlich aus diesen Tokens. **Kein** komponenten-lokales Hardcoden von Hex-Werten. Der aktive Modus + das aktive Theme bestimmen gemeinsam die konkreten Werte (siehe Sektion „Farb-Configs").

4. **Barrierefreiheit — Modus NIE nur über Farbe.** Rot-Grün-Sehschwäche betrifft ~8 % der Männer; Farbe allein darf den Modus nicht kodieren. Der Modus wird **redundant** getragen von (a) dem Farbakzent, (b) dem **Header-Modus-Label** (Klartext-Name), und (c) einem **„gesperrt"/Schloss-Affordance** auf nicht-editierbaren Controls im Live-Modus. Diese Redundanz ist Pflicht-AC in den betroffenen Stories.

5. **Theming ist Config — und ein Theme wird KOMPLETT gewechselt.** Der Modus-Akzent ist über eine **Theme-Registry** austauschbar. Ein „Theme" ist ein benanntes, **vollständiges** Skin-Config-Objekt, das je Shell-Modus (Prep/Live) einen kompletten Akzent-Satz liefert. Ein Theme-Wechsel ersetzt das **gesamte** Skin auf einmal — kein teilweises Übermalen.
   - **Dark/Light ist ein Erscheinungs-Modus, KEIN Theme.** Drei orthogonale Achsen, die nie vermischt werden dürfen: **(a) Shell-Modus** = Prep/Autor ⟷ Live/Session (das, was dieser Epic sonst schlicht „Modus" nennt); **(b) Erscheinungs-Modus** = Dark ⟷ Light (eine reine Anzeige-Präferenz); **(c) Theme** = das vollständige benannte Skin. Der **Dark/Light-Umschalter ist ein eigener Bedienpfad** und darf **niemals** das aktive Theme wechseln — und ein Theme-Wechsel darf **niemals** über den Dark/Light-Umschalter huckepack laufen. Genau diese falsche Kopplung existierte im früheren Beweis-Theme (Theme hing am Dark/Light-Toggle) und ist zu **entfernen**.
   - **Jedes Theme deklariert seine Komplexität auf zwei unabhängigen Achsen** (Details + Tabelle: Sektion „Theme-Komplexität"): **`modeSupport: 'unified' | 'per-mode'`** (eine Farbwelt für edit+play **oder** getrennte Akzente je Shell-Modus) und **`appearanceSupport: 'both' | 'dark' | 'light'`** (eigener, separat autorisierter Dark- **und** Light-Satz — Light **nie** aus dem Dark-Hue abgeleitet — **oder** nur eine Erscheinung, die dann erzwungen wird und den Dark/Light-Umschalter deaktiviert). Ihre Kombination ergibt **vier erlaubte Komplexitätsvarianten**; ein Custom-Theme darf jede sein. Ein `unified`-Theme ist erlaubt, **weil** der Modus nie nur über Farbe erkennbar ist (Header-Label + Lock tragen immer mit, Decision 4).
   - **Ausgeliefert werden zwei Themes:** **„Default"** = Variante 4 (`modeSupport: per-mode`, `appearanceSupport: both`; Prep = Rot, Live = Amber) und **„Teal"** = Variante 3 (`modeSupport: per-mode`, `appearanceSupport: dark` — Single-Mode dunkel; Prep = Rot, Live = Teal). „Teal" ist das **erste Beispiel-Theme**, an dem das Theming erklärt wird — es demonstriert bewusst den **Single-Appearance**-Zweig, „Default" den vollen Both-Zweig. So ist der Akzent nachweislich Config.

6. **Engine-Name ist Platzhalter, aber kein Blocker.** Der frühere Arbeitstitel „WorldAnvil" wird **nicht** verwendet (es existiert ein gleichnamiges reales Worldbuilding-Produkt → Kollision). Kandidaten: **„RuleLoom"** oder **„CodexLoom"**. Der finale Name ist noch offen; die Implementierung nutzt **einen einzigen Konstanten-/Übersetzungs-Key** mit Platzhalter-Wert, sodass ein späterer Namenswechsel eine Ein-Zeilen-Änderung ist.

7. **Alle Marken-/UI-Strings über `useTranslation` mit inline-deutschem Default** (`t('brand.platform','Worlds and Beyond')`), zentral registriert — **keine** verstreuten Hardcode-Strings. (Konsistenz mit der bestehenden i18n-Regel des Projekts.)

## Farb-Configs (konkret)

Semantische Accent-Tokens (Namen als Vorschlag; ein Token-Set, pro aktivem Shell-Modus × Theme belegt). Die Werte unten sind die **Dark-Erscheinung** des jeweiligen Themes. Ein Theme mit `appearanceSupport: both` bringt zusätzlich einen **separat autorisierten** Light-Token-Satz mit — dieser wird **nicht** aus dem Dark-Wert abgeleitet (Ableitung ist ausdrücklich verboten, s. Decision 5). Ein Single-Mode-Theme hat nur diese eine Erscheinung.

| Token | Zweck |
|---|---|
| `--mode-accent` | Grundfarbe (Streifen, Focus-Ring, gefüllter Primary-Button-Grund, aktiver-Tab-Marker) |
| `--mode-accent-hover` | Hover-Zustand des gefüllten Akzents |
| `--mode-accent-on` | Vordergrund (Text/Icon) **auf** gefülltem Akzent — kontrastgetrieben |
| `--mode-accent-text` | Akzent als Text/Icon/Label **auf dunkler** Fläche (Chip-Label, Pill, aktiver Tab-Text) |
| `--mode-accent-soft` | Weiche Tint-Fläche (Chip-/Pill-Hintergrund) = Grundfarbe @ ~16 % Alpha über der Fläche |

**Default-Theme:**

| Modus | `--mode-accent` | `--mode-accent-hover` | `--mode-accent-on` | `--mode-accent-text` | `--mode-accent-soft` |
|---|---|---|---|---|---|
| **RealmForge** (Prep/Autor) | `#e5484d` | `#ef5a5f` | `#ffffff` | `#f0888b` | `rgba(229,72,77,0.16)` |
| **Adventure Nexus** (Live/Session) | `#eaa53c` | `#f2b451` | `#241a05` | `#f2bd63` | `rgba(234,165,60,0.16)` |

*Default: `appearanceSupport: both` — Dark-Werte oben; der Light-Token-Satz wird in S03 separat autorisiert (WCAG-AA, nicht aus dem Dark-Hue abgeleitet).*

**Teal-Theme (erstes Alternativ-Theme):**

| Modus | `--mode-accent` | `--mode-accent-hover` | `--mode-accent-on` | `--mode-accent-text` | `--mode-accent-soft` |
|---|---|---|---|---|---|
| **RealmForge** (Prep/Autor) | `#e5484d` | `#ef5a5f` | `#ffffff` | `#f0888b` | `rgba(229,72,77,0.16)` |
| **Adventure Nexus** (Live/Session) | `#19b8a6` | `#2ad0bd` | `#04342c` | `#4fd8c8` | `rgba(25,184,166,0.16)` |

*Teal: `appearanceSupport: dark` (Single-Mode) — nur diese eine Erscheinung; bei aktivem Teal ist der Dark/Light-Umschalter wirkungslos/deaktiviert.*

**Kontrast-Hinweis (Pflicht):** `--mode-accent-on` ist bewusst pro Farbe verschieden. Auf dem hellen Amber (`#eaa53c`) und dem mittleren Teal (`#19b8a6`) hat **weißer** Text zu wenig Kontrast → dort **dunkler** Vordergrund. Auf dem Rot (`#e5484d`) ist weißer Text korrekt. Nicht vereinheitlichen.

**Warum Amber (Live) neben Rot (Prep) funktioniert:** Amber/Gold liegt in Helligkeit *und* im Blau-Kanal weit genug vom Rot, dass der „falsches-Fenster"-Reflex auch bei Rot-Grün-Sehschwäche trägt (ein *grüner* Live-Ton würde dort mit dem Rot verschmelzen — deshalb verworfen).

## Theme-Komplexität — vier erlaubte Varianten

Ein Theme (auch ein Custom-Theme) deklariert zwei **unabhängige** Fähigkeits-Achsen. Ihre Kombination ergibt vier erlaubte Komplexitätsstufen — von „eine Farbe für alles" bis voll:

| Variante | `modeSupport` | `appearanceSupport` | Bedeutung | Token-Sätze |
|---|---|---|---|---|
| 1 — minimal | `unified` | `dark` *oder* `light` | Eine Farbwelt für edit+play, eine Erscheinung | 1 |
| 2 | `unified` | `both` | Eine Farbwelt für edit+play, eigener Dark **und** Light | 2 |
| 3 | `per-mode` | `dark` *oder* `light` | Getrennte edit/play-Farben, eine Erscheinung | 2 |
| 4 — voll | `per-mode` | `both` | Getrennt je Modus **und** je Erscheinung | 4 |

- Ein „Token-Satz" = die fünf Accent-Tokens (`--mode-accent`, `--mode-accent-hover`, `--mode-accent-on`, `--mode-accent-text`, `--mode-accent-soft`).
- **Auflösung zur Laufzeit:** der aktive Akzent wird aus *aktivem Theme × aktivem Shell-Modus × aktiver Erscheinung* bestimmt; über nicht unterstützte Achsen wird zusammengefasst — `modeSupport: unified` ignoriert den Shell-Modus (edit und play teilen den Satz), eine Single-Appearance erzwingt ihre Erscheinung (Dark/Light-Umschalter dann deaktiviert).
- **Ausgelieferte Themes:** „Default" = Variante 4 (per-mode + both); „Teal" = Variante 3 (per-mode + dark).
- Ein `unified`-Theme (Variante 1 oder 2) verzichtet bewusst auf die farbliche Modus-Unterscheidung — **erlaubt**, weil der Modus nie nur über Farbe erkennbar ist (Header-Label + Lock, Decision 4).

## Out of Scope

- Account-basierter Theme-Sync über Geräte hinweg (V2, sobald Accounts existieren).
- Frei benutzerdefinierte Farbwahl / Farbwähler pro Nutzer (dieser Epic liefert **kuratierte** Themes, keinen Color-Picker).
- Per-Widget- oder Per-Entity-Individualfarben.
- Die **finale** Engine-Namens-Entscheidung (Platzhalter genügt; siehe Decision 6).
- macOS/WKWebView (nicht im aktuellen Scope).
- Der Shell-Umschalter selbst und die Modus-Transformation der Navigation (kommt aus dem M10-Multiplayer-Milestone; dieser Epic *konsumiert* den vorhandenen Modus-Zustand, baut ihn nicht).

## Code-Anker (Ist-Zustand, Stand der Recherche)

- **Shell-Modus:** `useAppMode()` in `src/ui/AppModeContext.tsx` liefert `mode: 'edit' | 'play'` (+ `sessionRole: 'dm' | 'player' | null`, `activeSessionId`). **`mode` ist die Quelle für Modus→Marke** — `edit` = RealmForge, `play` = Adventure Nexus. Für das Label **niemals** `sessionRole` verwenden (Decision 2).
- **Read-only/Lock:** `src/ui/useReadOnly.ts` (bestehendes Play-Modus-Gating) — Quelle für das „gesperrt"/Schloss-Affordance (Decision 4).
- **Shell-Header-Mount:** `src/ui/WorkspaceShell.tsx`.
- **Design-System:** `src/ui/primitives.tsx` (`Button`/`Panel`/`StatusChip`/`Tabs`/`Segmented`/`ListSurface`), Tokens in `src/styles/tokens.css`.
- **Theming Ist-Zustand (die zu entfernende FEHLKOPPLUNG):** `src/theme.ts` fasst Erscheinungs-Modus und Theme in **einer** Union `Theme = 'light' | 'dark' | 'toxic'` + **einem** `data-theme`-Attribut zusammen (`applyTheme`, `THEME_ORDER = ['light','dark']`, `getStoredTheme`, `initTheme`; persistiert unter `localStorage['theme']`; angewandt in `src/main.tsx`). Das frühere Beweis-Theme ist `src/styles/themes/toxic.css` (aktuell aus dem Cycle deaktiviert). Genau hier steckt die Achsen-Vermischung aus Decision 5: light/dark und Theme müssen **zwei** orthogonale, getrennt persistierte Achsen werden.

## Stories

### S01: Zentrale Marken-/Namens-Registry

**Ziel:** Alle Produkt-Namen leben an genau einer Stelle, übersetzbar, ohne verstreute Hardcode-Strings.

**AC:**
- Ein zentrales Modul (z.B. `src/branding/brand.ts` + i18n-Keys) exportiert: Plattformname (`"Worlds and Beyond"`), die zwei Modus-Marken (`"RealmForge"`, `"Adventure Nexus"`), und die Engine-Marke als **einzelner** Key mit Platzhalter-Wert (`"RuleLoom"` als Vorbelegung; austauschbar in einer Zeile).
- Jeder Wert wird über `useTranslation` mit inline-deutschem Default bezogen (`t('brand.mode.prep','RealmForge')` usw.).
- Keine dieser Zeichenketten erscheint hardcodiert an einer anderen Stelle im Code (Grep-Nachweis: die Marken-Strings existieren nur in der Registry/Übersetzungsdatei).
- Kein `## header`-Missbrauch, keine Magic-Strings wo eine Konstante passt.

---

### S02: Header-Identitätsleiste (Plattform + modus-gebundenes Label)

**Ziel:** Der Header zeigt dauerhaft die Plattform-Marke und daneben die Marke des **aktiven Modus**.

**AC:**
- Der Header zeigt: `Worlds and Beyond` (kleine, ruhige Kennung) **+** das aktive Modus-Label — `RealmForge` im Prep/Autor-Modus, `Adventure Nexus` im Live/Session-Modus.
- Das Label wird **aus dem aktiven Shell-Modus** abgeleitet: `useAppMode().mode` aus `src/ui/AppModeContext.tsx` (`edit` → `RealmForge`, `play` → `Adventure Nexus`). **Niemals** aus `sessionRole` (Decision 2) — ein DM im Live-Modus (`mode==='play'`) sieht `Adventure Nexus`. Mount im Header von `src/ui/WorkspaceShell.tsx`.
- Aufgebaut aus `src/ui/primitives.tsx` (`Panel`/Header-Container, `StatusChip`/Label-Pill); keine rohen ungestylten `<div>`/`<span>` für Marken-Chrome; Tokens aus `src/styles/tokens.css`, kein Hex hardcodiert.
- Alle sichtbaren Strings über `useTranslation` (S01-Registry).
- **Mount + Integrationstest:** Die Leiste wird im echten App-Shell-Header gemountet (Container/Mount-Punkt in der AC benannt); ein Integrationstest schaltet den Modus über den echten Umschalter um und prüft, dass das Header-Label von `RealmForge` auf `Adventure Nexus` wechselt — **nicht** nur ein isoliertes `render(<Header/>)`.

---

### S03: Modus-Akzent-Token-System (Default-Theme)

**Ziel:** Ein einziges Accent-Token-Set kippt mit dem Modus; alle Primitives ziehen ihre Akzentfarbe daraus.

**AC:**
- Die fünf Tokens aus Sektion „Farb-Configs" (`--mode-accent`, `-hover`, `-on`, `-text`, `-soft`) existieren in `src/styles/tokens.css` und werden beim **Shell-Moduswechsel (Prep⟷Live)** auf die **Default-Theme**-Werte gesetzt: Prep = Rot-Satz, Live = Amber-Satz (exakte Hex-Werte s.o.).
- Das **Default-Theme** deklariert `appearanceSupport: both`: neben den Dark-Werten (Tabelle) einen **separat autorisierten** Light-Token-Satz, der dieselben Rollen erfüllt und WCAG AA trifft — **nicht** aus dem Dark-Hue abgeleitet. Der Dark/Light-Umschalter wählt zwischen Dark und Light **innerhalb** des Themes; er wechselt **nicht** das Theme (Decision 5).
- `Button` (Primary), `StatusChip`, aktiver Tab-Marker, Focus-Ring und der Kopf-Akzentstreifen aus `src/ui/primitives.tsx` beziehen ihre Akzentfarbe **ausschließlich** aus diesen Tokens — kein komponenten-lokales Hex.
- `--mode-accent-on` ist pro Modus korrekt gesetzt (Rot → `#ffffff`, Amber → `#241a05`); Kontrast auf dem gefüllten Akzent erfüllt WCAG AA für Text.
- **Barrierefreiheit (Decision 4):** Im Live-Modus tragen nicht-editierbare Controls zusätzlich ein **„gesperrt"/Schloss-Affordance** (nutzt das bestehende Read-only-Gating `src/ui/useReadOnly.ts`), und das Header-Label ist sichtbar — der Modus ist damit **nicht nur** über Farbe erkennbar. (Guard: der Modus-Indikator existiert in mindestens zwei nicht-farblichen Formen.)
- **Mount + Integrationstest:** Test schaltet den Modus real um und prüft am gerenderten Primitive (z.B. Primary-`Button` oder Kopfstreifen), dass sich der berechnete Akzentwert von Rot auf Amber ändert.

---

### S04: Theme-Registry + erstes Alternativ-Theme „Teal"

**Ziel:** Der Modus-Akzent ist über benannte Themes austauschbar; „Teal" ist das ausgelieferte Beispiel.

**AC:**
- Eine **Theme-Registry** hält benannte Themes; jedes Theme liefert je Shell-Modus (Prep/Live) den vollständigen Fünf-Token-Satz **und** trägt ein Feld `appearanceSupport: 'both' | 'dark' | 'light'`. Ausgeliefert: **„Default"** (`both`; Prep Rot / Live Amber) und **„Teal"** (`dark` / Single-Mode; Prep Rot / Live Teal — exakte Werte s. Sektion „Farb-Configs").
- Ein aktives Theme ist auswählbar (Einstellungs-Bereich); die Auswahl wird persistiert.
- Theme-Wechsel ersetzt den **vollständigen** Token-Satz auf einmal, **live** ohne Reload; der aktive Shell-Modus bleibt unverändert (nur die Farbwerte hinter den Tokens ändern sich).
- **Entkopplung von Dark/Light (Decision 5, Pflicht):** Der Dark/Light-Umschalter (Erscheinungs-Modus) und die Theme-Auswahl sind **getrennte** Bedienpfade. Ein Dark/Light-Wechsel ändert **nicht** das aktive Theme; ein Theme-Wechsel wird **nicht** vom Dark/Light-Umschalter ausgelöst.
- **Erscheinungs-Handling nach `appearanceSupport`:** Bei einem `both`-Theme wählt der Dark/Light-Umschalter die Erscheinung **innerhalb** des Themes. Bei einem Single-Mode-Theme (z.B. „Teal" = `dark`) erzwingt das Theme seine Erscheinung, und der Dark/Light-Umschalter ist deaktiviert/wirkungslos.
- **Bestandsaufnahme + Entkopplung:** Der Ist-Zustand liegt in `src/theme.ts` — die Union `Theme = 'light' | 'dark' | 'toxic'` + das einzelne `data-theme`-Attribut fassen Erscheinungs-Modus und Theme fälschlich zusammen. Diese Kopplung wird in **zwei orthogonale, getrennt persistierte Achsen** getrennt: Erscheinungs-Modus (`'light' | 'dark'`) **und** Theme (`'default' | 'teal'`). Das Beweis-Theme `src/styles/themes/toxic.css` wird durch echte Theme-Definitionen ersetzt. Kein Revert/Umbau ohne benannten Root-Cause.
- Die Prep/Autor-Identität (Rot) bleibt in beiden ausgelieferten Themes stabil; die Token-Struktur erlaubt einem künftigen Theme aber auch, den Prep-Akzent zu überschreiben (kein Sonderfall im Code — Prep ist ein normales Token wie Live).
- Auswahl-UI aus `src/ui/primitives.tsx` (`Segmented`/`Tabs` oder `ListSurface`); Tokens statt Hex; Strings über `useTranslation`.
- Keine Kompat-/Dual-Format-Schichten; ein Theme-Shape, fire-and-forget.
- **Mount + Integrationstests:** (1) Test wählt „Teal", prüft am gerenderten Live-Modus-Primitive, dass der Akzent von Amber (`#eaa53c`) auf Teal (`#19b8a6`) wechselt und der Prep-Akzent Rot bleibt. (2) **Entkopplungstest:** ein Dark/Light-Wechsel lässt das aktive Theme unverändert — und umgekehrt. (3) Bei aktivem „Teal" (Single-Mode) ist der Dark/Light-Umschalter deaktiviert/wirkungslos.

---

### S05: Engine-Marke an den USP-Flächen

**Ziel:** Die Engine-Marke erscheint dort, wo der „jedes-System"-USP verkauft wird — und nirgends als Nav-Modus.

**AC:**
- Die Engine-Marke (S01-Key, Platzhalter „RuleLoom") wird angezeigt an: dem System-/Plugin-Manager-Kopf und dem Onboarding-Schritt „wähle/erstelle dein Regelsystem" (und optional Splash). Quelle ist der **einzelne** Registry-Key.
- Die Engine-Marke erscheint **nicht** im Modus-Umschalter und ist **kein** eigener Shell-Modus.
- Aufbau aus `primitives.tsx`; Strings über `useTranslation`.
- **Mount-Nachweis:** Grep zeigt, dass die Engine-Marke ausschließlich über den Registry-Key und nur an den benannten Flächen gemountet wird.

## Story Tracking

| Story | ID | Titel |
|---|---|---|
| S01 | #381 | Zentrale Marken-/Namens-Registry |
| S02 | #383 | Header-Identitätsleiste (Plattform + modus-gebundenes Label) |
| S03 | #382 | Modus-Akzent-Token-System (Default-Theme) |
| S04 | #385 | Theme-Registry + erstes Alternativ-Theme „Teal" |
| S05 | #384 | Engine-Marke an den USP-Flächen |

Milestone: **M17 - Product Identity & Mode Theming** (GitHub-Milestone #20). Reihenfolge: #381 → #382 → (#383 · #385 · #384).

## Abhängigkeiten

- **M10-Multiplayer-Shell-Umschalter** (Bearbeiten⟷Spielen + Modus-Transformation der Navigation): liefert den aktiven Modus-Zustand, den dieser Epic konsumiert. S02–S04 setzen ihn voraus.
- `src/ui/primitives.tsx` + `src/styles/tokens.css` (Design-System-Grundlage).
- Bestehende i18n-Infrastruktur (`useTranslation`).
