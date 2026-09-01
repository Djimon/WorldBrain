// M17-S01 (#381): Central brand/naming registry — the ONE source for all
// product brands (platform, the two mode brands, the rule engine). i18n-capable
// via the `common` namespace with an inline German default; the brand strings
// are NOT hardcoded ANYWHERE else (grep guard in WorkspaceShell/primitives).
//
// Epic: planning/epics/identity-naming-mode-theming.md (Story S01, Decision 2).
import { useTranslation } from 'react-i18next';

export interface Brand {
  /** Platform brand — the umbrella over both modes. */
  platform: string;
  /** Mode brand for edit/prep. */
  editMode: string;
  /** Mode brand for play/live. */
  playMode: string;
  /** System-agnostic rule engine (the USP feature). Placeholder value,
   *  final name still open — swappable in ONE line (default + locale). */
  engine: string;
}

/**
 * React hook: resolves all product brands via i18n (inline German default,
 * so the app renders correctly even without a locale entry). Consumers (#383/#385)
 * obtain brands ONLY through this, never as their own string literals.
 */
export function useBrand(): Brand {
  const { t } = useTranslation('common');
  return {
    platform: t('brand.platform', 'Worlds and Beyond'),
    editMode: t('brand.mode.edit', 'RealmForge'),
    playMode: t('brand.mode.play', 'Adventure Nexus'),
    engine: t('brand.engine', 'RuleLoom'),
  };
}
