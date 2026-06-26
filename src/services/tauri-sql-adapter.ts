import Database from '@tauri-apps/plugin-sql';
import type { DatabaseLike } from './entity-service';

type SqliteRow = Record<string, unknown>;

export class TauriSqlAdapter implements DatabaseLike {
  private constructor(private readonly db: InstanceType<typeof Database>) {}

  static async load(dbPath: string): Promise<TauriSqlAdapter> {
    const db = await Database.load(`sqlite:${dbPath}`);
    return new TauriSqlAdapter(db);
  }

  exec(sql: string): void {
    void this.db.execute(sql);
  }

  async flush(): Promise<void> {
    await this.db.execute('SELECT 1');
  }

  async execute(sql: string, bindValues: unknown[] = []): Promise<void> {
    await this.db.execute(sql, bindValues);
  }

  async select<T = SqliteRow>(sql: string, bindValues: unknown[] = []): Promise<T[]> {
    return this.db.select<T[]>(sql, bindValues);
  }
}
