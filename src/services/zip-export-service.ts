import { createSnapshot } from './snapshot-service';

export function buildZipFilename(title: string, date: Date = new Date()): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const dateStr = date.toISOString().slice(0, 10);
  return `${slug}-${dateStr}.zip`;
}

export function getZipExclusions(): string[] {
  return ['*.sqlite', '*.db', 'runtime.db', 'snapshots/'];
}

export function exportProjectToZip(opts: {
  projectId: string;
  projectPath: string;
  title: string;
  outputPath: string;
}): void {
  createSnapshot({ projectId: opts.projectId, name: `pre-export-${Date.now()}` });
  // ZIP creation delegated to Tauri FS / shell API in production
}
