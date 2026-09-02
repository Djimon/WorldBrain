import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Segmented, StatusChip, ListRow } from './primitives';
import { ThemePicker } from './ThemePicker';
import { appBuildVersion } from '../branding/version';

/** Play-mode settings ("Session Context"). Same sidebar + detail shell as the edit-side
 *  SettingsPanel (#410), so the two settings screens feel identical. Categories:
 *  Session (campaign/role/leave) · Appearance (theme) · Info (context + multiplayer teaser). */
type PlayCategory = 'session' | 'appearance' | 'info';

const CATS: readonly { id: PlayCategory; icon: string; labelKey: string }[] = [
  { id: 'session', icon: '🎲', labelKey: 'session' },
  { id: 'appearance', icon: '🎨', labelKey: 'settingsCat.appearance' },
  { id: 'info', icon: 'ℹ️', labelKey: 'playSettingsInfo' },
];

interface PlaySettingsPanelProps {
  projectId: string;
  projectTitle?: string;
  availableCampaigns: { id: string; title: string }[];
  activeSessionId: string | null;
  sessionRole: 'dm' | 'player' | null;
  onSwitchCampaign: (campaignId: string) => void;
  onSwitchRole: (role: 'dm' | 'player') => void;
  onLeave: () => void;
}

export function PlaySettingsPanel({
  projectId,
  projectTitle,
  availableCampaigns,
  activeSessionId,
  sessionRole,
  onSwitchCampaign,
  onSwitchRole,
  onLeave,
}: PlaySettingsPanelProps) {
  const { t } = useTranslation('nav');
  const [cat, setCat] = useState<PlayCategory>('session');

  const activeCampaign = availableCampaigns.find((c) => c.id === activeSessionId);
  const roleLabel = sessionRole === 'player' ? t('modeRolePlayer', 'Als Player') : t('modeRoleDm', 'Als DM');

  return (
    <div className="settings">
      <header className="settings__topbar">
        <span className="settings__title">{t('settingsTitle', 'Einstellungen')}</span>
        <StatusChip>v{appBuildVersion}</StatusChip>
      </header>
      <div className="settings__body">
        <nav className="settings__nav" aria-label={t('play-settings')}>
          <div className="u-stack u-gap-1">
            {CATS.map((c) => (
              <ListRow key={c.id} as="button" selected={cat === c.id} aria-current={cat === c.id} onClick={() => setCat(c.id)}>
                <span className="settings__nav-icon" aria-hidden="true">{c.icon}</span>
                <span className="settings__nav-label">{t(c.labelKey)}</span>
              </ListRow>
            ))}
          </div>
        </nav>

        <div className="settings__detail">
          {cat === 'session' && (
            <section className="settings__pane u-stack u-gap-4">
              <h2 className="settings__pane-title">{t('session', 'Session')}</h2>

              <div className="u-stack u-gap-1">
                <span className="settings__block-label">{t('playSettingsCampaign', 'Campaign')}</span>
                {availableCampaigns.length > 0 ? (
                  <Segmented
                    label={t('playSettingsCampaign', 'Campaign')}
                    value={activeSessionId ?? ''}
                    onChange={onSwitchCampaign}
                    size="compact"
                    options={availableCampaigns.map((c) => ({ id: c.id, label: c.title }))}
                  />
                ) : (
                  <p className="settings__muted">{t('playSettingsNoCampaigns', 'Keine Campaigns vorhanden.')}</p>
                )}
              </div>

              <div className="u-stack u-gap-1">
                <span className="settings__block-label">{t('playSettingsRole', 'Rolle')}</span>
                <Segmented
                  label={t('playSettingsRole', 'Rolle')}
                  value={sessionRole ?? 'dm'}
                  onChange={(id) => onSwitchRole(id === 'player' ? 'player' : 'dm')}
                  size="compact"
                  options={[
                    { id: 'dm', label: t('modeRoleDm', 'Als DM') },
                    { id: 'player', label: t('modeRolePlayer', 'Als Player') },
                  ]}
                />
              </div>

              <hr className="settings__divider" />
              <Button tone="danger" variant="outline" onClick={onLeave}>
                {t('playSettingsLeave', 'Session verlassen')}
              </Button>
            </section>
          )}

          {cat === 'appearance' && (
            <section className="settings__pane u-stack u-gap-3">
              <h2 className="settings__pane-title">{t('settingsCat.appearance')}</h2>
              <ThemePicker />
            </section>
          )}

          {cat === 'info' && (
            <section className="settings__pane u-stack u-gap-3">
              <h2 className="settings__pane-title">{t('playSettingsInfo', 'Session-Info')}</h2>
              {/* Multiplayer/connection is NOT here — it belongs to the Lobby (separate issue). */}
              <dl className="settings__about">
                <div><dt>{t('playSettingsProject', 'Projekt')}</dt><dd>{projectTitle ?? projectId}</dd></div>
                <div><dt>{t('playSettingsCampaign', 'Campaign')}</dt><dd>{activeCampaign?.title ?? '—'}</dd></div>
                <div><dt>{t('playSettingsRole', 'Rolle')}</dt><dd>{roleLabel}</dd></div>
              </dl>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
