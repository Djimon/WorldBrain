export interface ZipValidationResult {
  valid: boolean;
  projectJson?: Record<string, unknown>;
  error?: string;
}

export function validateProjectZip(_zipPath: string): ZipValidationResult {
  // Tauri FS API handles ZIP extraction in production; stub for web context
  return { valid: false, error: 'Not implemented in web context' };
}

export function importProjectZip(opts: {
  zipPath: string;
  baseDir?: string;
  conflictStrategy?: 'overwrite' | 'keep-both';
}): { id: string; path: string } {
  const id = `proj-imported-${Date.now()}`;
  return { id, path: opts.baseDir ? `${opts.baseDir}/${id}` : id };
}
