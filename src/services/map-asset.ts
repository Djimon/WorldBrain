import { copyFile, mkdir } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';

/**
 * Copies a source image into the project's `assets/maps` directory and returns
 * the absolute destination path. Shared by the base-map import and the
 * per-layer image import so both produce the exact same on-disk asset layout
 * (`assets/maps/<basename>.<ext>`) — no second importer.
 */
export async function copyMapAsset(srcPath: string, projectDir: string, basename: string): Promise<string> {
  const assetsDir = await join(projectDir, 'assets', 'maps');
  await mkdir(assetsDir, { recursive: true });
  const ext = srcPath.split('.').pop() ?? 'png';
  const destPath = await join(assetsDir, `${basename}.${ext}`);
  await copyFile(srcPath, destPath);
  return destPath;
}
