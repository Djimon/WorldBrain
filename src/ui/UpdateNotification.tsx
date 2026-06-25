import { useState } from 'react';

interface UpdateNotificationProps {
  version?: string;
  onInstall?: () => void;
}

export function UpdateNotification({ version, onInstall }: UpdateNotificationProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div role="status" aria-live="polite">
      <p>Update verfügbar{version ? ` (v${version})` : ''}.</p>
      <button onClick={onInstall}>Installieren</button>
      <button onClick={() => setDismissed(true)}>Schließen</button>
    </div>
  );
}
