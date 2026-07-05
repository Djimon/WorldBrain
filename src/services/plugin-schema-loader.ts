// M9-S08: eager entity-type schema loader + db-prefix materialization — stub (#220)
import type { DatabaseLike } from './entity-service';

interface PluginManifestForLoading {
  id: string;
  db_prefix?: string;
  entity_types?: string[];
}

export async function loadPluginEntityTypes(_args: {
  database: DatabaseLike;
  pluginDir: string;
  manifest: PluginManifestForLoading;
}): Promise<void> {
  throw new Error('not implemented');
}
