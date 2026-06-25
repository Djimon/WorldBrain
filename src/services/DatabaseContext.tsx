import { createContext, useContext } from 'react';
import type { DatabaseLike } from './entity-service';

export const DatabaseContext = createContext<DatabaseLike | null>(null);
export const DatabaseProvider = DatabaseContext.Provider;

export function useDatabase(): DatabaseLike {
  const db = useContext(DatabaseContext);
  if (!db) throw new Error('useDatabase must be used within DatabaseProvider');
  return db;
}
