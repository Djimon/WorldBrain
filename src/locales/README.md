# Locale Files

WorldBuilderX uses [react-i18next](https://react.i18next.com/) for internationalization.

## Directory Structure

```
src/locales/
  en/          # English (default / fallback)
    common.json
    nav.json
    entity.json
    map.json
    session.json
  de/          # German
    common.json
    nav.json
    entity.json
    map.json
    session.json
  README.md    # this file
```

Each language has one JSON file per **namespace** (`common`, `nav`, `entity`, `map`, `session`).  
Keys are dot-separated strings, e.g. `entity:type.character`.

## Adding a Custom Language

1. Create a new folder under `appDataDir/locales/<lang>/` (e.g. `appDataDir/locales/fr/`).
2. Copy the namespace JSON files from `src/locales/en/` into that folder.
3. Translate the values — **do not change the keys**.
4. Restart the app. WorldBuilderX scans `appDataDir/locales/` on startup and registers any found `<lang>/<namespace>.json` files.
5. The new language appears in Settings → Language selector.

**Tip:** The JSON files are plain text and can be edited in VS Code or any text editor without rebuilding the app.

## Key Parity

All keys present in `en/` must also exist in `de/` (and any custom locale). The test suite (`m11-s07-translation-parity.test.ts`) enforces this automatically.
