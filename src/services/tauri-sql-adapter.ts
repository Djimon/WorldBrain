// Tauri SQL adapter — implements DatabaseLike on top of @tauri-apps/plugin-sql.
// Tests mock DatabaseLike directly; this adapter is only used in the Tauri WebView runtime.
import Database from '@tauri-apps/plugin-sql';
import type { DatabaseLike } from './entity-service';

type SqliteRow = Record<string, unknown>;

export class TauriSqlAdapter implements DatabaseLike {
  private constructor(private readonly db: InstanceType<typeof Database>) {}

  static async load(dbPath: string): Promise<TauriSqlAdapter> {
    const db = await Database.load(`sqlite:${dbPath}`);
    return new TauriSqlAdapter(db);
  }

  prepare(sql: string) {
    const db = this.db;
    return {
      all(...args: unknown[]): Array<SqliteRow> {
        // @tauri-apps/plugin-sql is async; callers should use TauriSqlAdapter.select() directly.
        // This synchronous stub exists for interface compatibility during schema setup.
        void db.select<SqliteRow[]>(sql, args);
        return [];
      },
      run(...args: unknown[]): void {
        void db.execute(sql, args);
      },
      get(...args: unknown[]): SqliteRow | undefined {
        void db.select<SqliteRow[]>(sql, args);
        return undefined;
      },
    };
  }

  async execute(sql: string, bindValues: unknown[] = []): Promise<void> {
    await this.db.execute(sql, bindValues);
  }

  async select<T = SqliteRow>(sql: string, bindValues: unknown[] = []): Promise<T[]> {
    return this.db.select<T[]>(sql, bindValues);
  }
}
