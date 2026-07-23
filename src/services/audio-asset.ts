// M15-S16 (#287): copies an imported local audio file into the project's
// assets/audio directory (same pattern as map-asset.ts's copyMapAsset) so
// the project stays self-contained/portable rather than referencing a path
// outside it that could move or vanish.
import { copyFile, mkdir } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';

export async function copyAudioAsset(srcPath: string, projectDir: string, basename: string): Promise<string> {
  const assetsDir = await join(projectDir, 'assets', 'audio');
  await mkdir(assetsDir, { recursive: true });
  const ext = srcPath.split('.').pop() ?? 'mp3';
  const destPath = await join(assetsDir, `${basename}.${ext}`);
  await copyFile(srcPath, destPath);
  return destPath;
}
