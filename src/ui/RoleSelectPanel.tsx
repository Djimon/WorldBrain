// M10-#432 (refactor): the "campaign + role" selection step, extracted verbatim from
// WorkspaceShell's inline showRoleSelect branch (#390). Pure presentation — all state +
// actions live in usePlaySession; the shell wires them in.
import { useTranslation } from 'react-i18next';
import type { Campaign } from '../services/campaign-service';
import { Button, Field, Panel, Segmented } from './primitives';

export interface RoleSelectPanelProps {
  availableCampaigns: Campaign[];
  selectedCampaignForPlay: string;
  onSelectCampaign: (id: string) => void;
  newCampaignTitle: string;
  onNewCampaignTitleChange: (title: string) => void;
  onCreateCampaign: () => void;
  onPickRole: (role: 'dm' | 'player') => void;
  onCancel: () => void;
}

export function RoleSelectPanel({
  availableCampaigns, selectedCampaignForPlay, onSelectCampaign,
  newCampaignTitle, onNewCampaignTitleChange, onCreateCampaign, onPickRole, onCancel,
}: RoleSelectPanelProps) {
  const { t } = useTranslation('nav');
  return (
    <Panel className="workspace-area workspace-shell__role-select" role="dialog"
      aria-label={t('modeRolePickTitle', 'Rolle wählen')}>
      <p>{t('modeRolePickPrompt', 'Campaign und Rolle wählen:')}</p>
      <div className="workspace-shell__role-campaign u-stack u-gap-2">
        {availableCampaigns.length > 0 && (
          <Segmented
            label={t('modeCampaign', 'Campaign')}
            value={selectedCampaignForPlay}
            onChange={onSelectCampaign}
            size="compact"
            options={availableCampaigns.map((c) => ({ id: c.id, label: c.title }))}
          />
        )}
        {availableCampaigns.length === 0 && (
          <div className="u-row u-gap-2">
            <Field
              label={t('modeCampaignNew', 'Neue Campaign')}
              value={newCampaignTitle}
              onChange={(e) => onNewCampaignTitleChange(e.target.value)}
              placeholder={t('modeCampaignNewPh', 'Titel')}
            />
            <Button
              onClick={onCreateCampaign}
              disabled={newCampaignTitle.trim() === ''}
            >
              {t('modeCampaignCreate', 'Anlegen')}
            </Button>
          </div>
        )}
      </div>
      <div className="workspace-shell__role-buttons">
        <Button tone="accent" onClick={() => onPickRole('dm')}>
          {t('modeRoleDm', 'Als DM')}
        </Button>
        <Button
          disabled={selectedCampaignForPlay === ''}
          onClick={() => onPickRole('player')}
        >
          {t('modeRolePlayer', 'Als Player')}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          {t('cancel', { ns: 'common' })}
        </Button>
      </div>
    </Panel>
  );
}

export default RoleSelectPanel;
