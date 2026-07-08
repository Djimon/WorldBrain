// M9-S08: eager entity-type schema loader + db-prefix materialization
// (EPIC-014 decisions 14+17). Reads each entity_types/*.json listed in the
// manifest, registers it in the entity-type registry, and eager-materializes
// a dedicated `<db_prefix>_<entityTypeId>` table — resolving the previously
// dead loader (registerPluginEntityType was declared but never called).
import { readTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import type { DatabaseLike } from './entity-service';
import { registerPluginEntityType } from './plugin-entity-service';
import type { PluginEntityType } from './plugin-entity-service';

interface PluginManifestForLoading {
  id: string;
  db_prefix?: string;
  entity_types?: unknown[];
}

// #224: db_prefix and entity_type ids are plugin-authored and get
// interpolated directly into CREATE TABLE DDL. SQLite has no bind-parameter
// support for identifiers (only values), so a strict charset whitelist is
// the only valid defense against a malicious/malformed manifest injecting
// arbitrary SQL via the table name.
const SAFE_IDENTIFIER = /^[a-z][a-z0-9_]*$/;

export async function loadPluginEntityTypes(args: {
  database: DatabaseLike;
  pluginDir: string;
  manifest: PluginManifestForLoading;
}): Promise<void> {
  const { database, pluginDir, manifest } = args;
  const prefix = manifest.db_prefix ?? manifest.id;
  if (!SAFE_IDENTIFIER.test(String(prefix))) {
    throw new Error(`Invalid db_prefix: ${String(prefix)}`);
  }

  for (const typeId of manifest.entity_types ?? []) {
    // Malicious/malformed entity-type id → skip it, same as a missing file
    // below; the rest of the plugin's entity types still load.
    if (!SAFE_IDENTIFIER.test(String(typeId))) continue;
    const path = await join(pluginDir, 'entity_types', `${typeId}.json`);
    let entityType: PluginEntityType;
    try {
      // Missing/malformed entity-type file at a load boundary → skip it
      // (AP-006 filesystem/JSON exception), rest of the plugin still loads.
      const raw = await readTextFile(path);
      entityType = JSON.parse(raw) as PluginEntityType;
    } catch {
      continue;
    }

    registerPluginEntityType(entityType, manifest.id);

    await database.execute(
      `CREATE TABLE IF NOT EXISTS ${prefix}_${typeId} (id TEXT PRIMARY KEY, data_json TEXT NOT NULL)`,
    );
  }
}
