import { getPluginRegistry } from '../services/plugin-loader';

export function PluginManager() {
  const registry = getPluginRegistry();
  const entries = Object.values(registry);

  return (
    <div>
      <h2>Plugin Manager</h2>
      <ul>
        {entries.map((entry) => (
          <li key={entry.manifest.id}>
            <strong>{entry.manifest.label}</strong>
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
