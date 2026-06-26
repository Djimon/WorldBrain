import Database from '@tauri-apps/plugin-sql';
import type { DatabaseLike } from './entity-service';

type SqliteRow = Record<string, unknown>;

export class TauriSqlAdapter implements DatabaseLike {
  private constructor(private readonly db: InstanceType<typeof Database>) {}

  static async load(dbPath: string): Promise<TauriSqlAdapter> {
    const db = await Database.load(`sqlite:${dbPath}`);
    return new TauriSqlAdapter(db);
  }

  // Sync exec() for schema setup helpers that call db.exec(sql).
  // SQLite serializes all commands — fire-and-forget is safe here;
  // caller must await adapter.flush() after all schema calls.
  exec(sql: string): void {
    void this.db.execute(sql);
  }

  // Drain any queued fire-and-forget exec() calls before continuing.
  async flush(): Promise<void> {
    await this.db.execute('SELECT 1');
  }

  // DatabaseLike.prepare() cannot be implemented synchronously on an async backend.
  // Use execute() / select() directly for all DB access in Tauri context.
  // BLOCKED: DatabaseLike interface must become async before prepare() can return real data.
  prepare(_sql: string): ReturnType<DatabaseLike['prepare']> {
    throw new Error(
      'TauriSqlAdapter.prepare() is not implemented — use execute() or select() for async Tauri SQL.'
    );
  }

  async execute(sql: string, bindValues: unknown[] = []): Promise<void> {
    await this.db.execute(sql, bindValues);
  }

  async select<T = SqliteRow>(sql: string, bindValues: unknown[] = []): Promise<T[]> {
    return this.db.select<T[]>(sql, bindValues);
  }
}
