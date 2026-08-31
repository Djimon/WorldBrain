import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface UpdateNotificationProps {
  version?: string;
  onInstall?: () => void;
}

export function UpdateNotification({ version, onInstall }: UpdateNotificationProps) {
  const { t } = useTranslation('nav');
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div role="status" aria-live="polite">
      <p>{version ? t('update.availableVersion', { version }) : t('update.available')}</p>
      <button onClick={onInstall}>{t('update.install')}</button>
      <button onClick={() => setDismissed(true)}>{t('close', { ns: 'common' })}</button>
    </div>
  );
}
