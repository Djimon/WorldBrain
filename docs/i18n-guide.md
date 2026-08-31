# Lokalisierung (i18n) — Kurzanleitung für Devs & Agenten

react-i18next, Namespaces `common | nav | entity | map | session | multiplayer`,
Locale-Dateien unter `src/locales/{en,de}/<ns>.json`, Init in `src/i18n.ts`.

## ⛔ Grundregeln (hart)

1. **Jeder nutzer-sichtbare String über `t(...)`** — und zwar auch die leicht
   vergessenen: `title=` (Mouse-over-Tooltip!), `aria-label=`, `placeholder=`,
   `alt=`, `<option>`-Texte, Empty-States, Confirm-Dialoge. Kein roher Text im
   JSX oder in String-Attributen.

2. **Der Key MUSS in der Locale-JSON existieren** — sonst rendert die Komponente
   *für immer still Deutsch*. `t('key', 'Deutscher Default')` mit **fehlendem**
   Key nutzt den Inline-Default und schaltet **nie** auf Englisch. Der Default
   ist ein Notnagel für die Ladezeit, **kein Ersatz** für den Key. Das ist der
   häufigste und unsichtbarste Fehler (die Komponente sieht „lokalisiert" aus,
   ist es aber nicht). → Key in `en/<ns>.json` **und** `de/<ns>.json` anlegen.

3. **Beide Sprachen, identische Keys** (en↔de-Parität). `de` = deutscher Text,
   `en` = natürliche englische Übersetzung; Interpolation `{{name}}` in beiden
   gleich. Plurale via i18next: `key_one` / `key_other`.

4. **Generika nur aus `common`.** `save · cancel · delete · close · create ·
   edit · all · back · add · remove · yes · no · confirm · loading · error ·
   search · filter` leben **einmal** in `common` und werden via
   `t('save', { ns: 'common' })` bezogen — **niemals** in einem anderen
   Namespace neu definiert. „Abbrechen" braucht man 1×, nicht 10×.

5. **Namespace nach Bereich:** `nav` (Shell/Nav/Settings/Suche/Graph/Audio),
   `entity`, `map`, `session`, `multiplayer` (Play/Lobby), `common` (echte
   Generika + geteilte Primitives). Bloßes `useTranslation()` ⇒ Default `common`
   — für bereichs-spezifische Komponenten **explizit** den passenden Namespace
   angeben (`useTranslation('map')`), damit keine Fach-Keys in `common` landen.

6. **Kein Deutsch im Datenmodell.** Persistierte Seed-/Default-Werte (Namen,
   Titel, die in die DB geschrieben werden) sind **Daten**, keine UI-Labels —
   sie gehören auf **Englisch** ins Backend, nicht via i18n „übersetzt". Beispiel:
   der Default-Name einer neuen Ära ist `'New Era'`, nicht `'Neue Ära'`.
   (Datenmodell-Sprache = Englisch; die Anzeige-Sprache macht die i18n-Schicht.)

## Durchsetzung (maschinell — bricht den Commit)

`npm run lint` fährt neben ESLint zwei i18n-Gates auf **0**:

- **`scripts/check-i18n-missing-keys.mjs`** —
  **(A)** jeder im Code genutzte `t('key')` hat einen echten Locale-Key (fängt
  Regel 2, „gewrappt aber Key fehlt → still Deutsch");
  **(B)** kein Generikum außerhalb `common` (Regel 4, DRY). Echte semantische
  Kollisionen (ein Modus-/Options-**Name**, der zufällig wie ein Generikum
  heißt, z. B. der „Bearbeiten"-Modus-Name vs. die Edit-Aktion) stehen auf der
  **Allowlist** im Script — knapp halten, nur echte False-Positives.
- **`tests/m11-s01-i18n-foundation.test.ts`** — en↔de-Key-Parität + Struktur.

## Verifizieren

Sprache im Header auf **English** stellen und den Screen durchklicken — inkl.
**Tooltips (Mouse-over)** und Dialoge. Dann `node scripts/check-i18n-missing-keys.mjs`
→ beide `TOTAL` = 0.
