// M17-S01 (#381): Zentrale Marken-/Namens-Registry — die EINE Quelle für alle
// Produkt-Marken (Plattform, die zwei Modus-Marken, die Regel-Engine). i18n-fähig
// über den `common`-Namespace mit inline-deutschem Default; die Marken-Strings
// werden NIRGENDS sonst hardcodiert (Grep-Guard in WorkspaceShell/primitives).
//
// Epic: planning/epics/identity-naming-mode-theming.md (Story S01, Decision 2).
import { useTranslation } from 'react-i18next';

export interface Brand {
  /** Plattform-Marke — das Dach über beiden Modi. */
  platform: string;
  /** Modus-Marke Bearbeiten/Prep. */
  editMode: string;
  /** Modus-Marke Spielen/Live. */
  playMode: string;
  /** System-agnostische Regel-Engine (das USP-Feature). Platzhalter-Wert,
   *  finaler Name noch offen — in EINER Zeile austauschbar (Default + Locale). */
  engine: string;
}

/**
 * React-Hook: löst alle Produkt-Marken über i18n auf (inline-deutscher Default,
 * damit die App auch ohne Locale-Eintrag korrekt rendert). Konsumenten (#383/#385)
 * beziehen Marken NUR hierüber, nie als eigene String-Literale.
 */
export function useBrand(): Brand {
  const { t } = useTranslation('common');
  return {
    platform: t('brand.platform', 'Beyond Worlds'),
    editMode: t('brand.mode.edit', 'RealmForge'),
    playMode: t('brand.mode.play', 'Adventure Nexus'),
    engine: t('brand.engine', 'RuleLoom'),
  };
}
