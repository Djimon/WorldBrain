import { useTranslation } from 'react-i18next';
import { getPluginRegistry } from '../services/plugin-loader';
import { StatusChip } from './primitives';

export function PluginManager() {
  const { t } = useTranslation();
  const registry = getPluginRegistry();
  const entries = Object.values(registry);

  return (
    <div>
      {/* M17-S05 (#384): USP area — the engine brand (single registry key
          from #381) at the top of the rule-system/plugin management. The engine brand
          is NOT a shell mode and does NOT appear in the mode toggle. */}
      <header className="u-row u-gap-2">
        <StatusChip tone="accent" aria-label={t('engineBrandAria', 'Regel-Engine')}>
          {t('brand.engine', { ns: 'common' })}
        </StatusChip>
        <h2>{t('pluginManagerTitle', 'Plugin Manager')}</h2>
      </header>
      <ul>
        {entries.map((entry) => (
          <li key={entry.manifest.id}>
            <strong>{entry.manifest.name}</strong>
            {' '}
            <span data-testid={`status-${entry.manifest.id}`} data-status={entry.status}>[{entry.status}]</span>
            {' '}
            <span>v{entry.manifest.version}</span>
            {' '}
            <span data-testid={`types-${entry.manifest.id}`}>{(entry.manifest.entity_types?.length ?? 0)} contributed type{(entry.manifest.entity_types?.length ?? 0) === 1 ? '' : 's'}</span>
            {entry.errors && entry.errors.length > 0 && (
              <ul>
                {entry.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
