// EPIC-024 M15-S10 (#281): root component for the detached soundboard
// WebviewWindow — own AudioContext (D1), reads/writes the SAME SQLite DB as
// the main window (no separate audio DB), autoplay gate overlay shown only
// if the AudioContext actually starts suspended (per Decision D8 the local
// Web Audio autoplay policy is untested/separate from the YouTube tier's
// spike — never assume, always check `audioContext.state`).
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import { openProjectDb } from '../services/db-init';
import { DatabaseProvider } from '../services/DatabaseContext';
import { listScene, listScenes } from '../services/audio-service';
import { LocalAudioEngine } from '../services/local-audio-engine';
import { YoutubeTierEngine } from '../services/youtube-tier-engine';
import { SpotifyTierEngine } from '../services/spotify-tier-engine';
import { stopSceneAudio } from '../services/stop-scene-audio';
import { SceneSwitcher } from './SceneSwitcher';
import { SoundboardBoard } from './SoundboardBoard';
import { ClipEditor } from './ClipEditor';
import { EmojiPickerHostProvider } from './EmojiPickerHost';

type WindowMode =
  | { kind: 'loading' }
  | { kind: 'no-project' }
  | { kind: 'gate'; db: DatabaseLike; audioContext: AudioContext }
  | { kind: 'ready'; db: DatabaseLike; audioContext: AudioContext };

export interface AudioSoundboardWindowProps {
  dbPath: string | null;
  projectDir: string | null;
}

export function AudioSoundboardWindow({ dbPath, projectDir }: AudioSoundboardWindowProps) {
  const { t } = useTranslation('nav');
  const [mode, setMode] = useState<WindowMode>({ kind: 'loading' });
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!dbPath) { setMode({ kind: 'no-project' }); return; }
    if (!audioContextRef.current) audioContextRef.current = new AudioContext();
    const audioContext = audioContextRef.current;
    // Guards the async continuation below — without this, React 18
    // StrictMode's dev-only mount->cleanup->mount cycle leaves TWO
    // in-flight openProjectDb() calls (one per pass), each capturing its
    // OWN audioContext in this closure. Nulling the ref in cleanup (below)
    // only fixes which context the SECOND pass creates — it does nothing
    // to stop the FIRST pass's already-in-flight promise from resolving
    // later and calling setMode() with ITS (by-then-closed) context,
    // clobbering the correct one depending purely on which async I/O call
    // happens to finish last. That race is why this looked "fixed" for a
    // while and then silently broke again with no code changes: whichever
    // pass won the race varied by timing, not by anything the fix controlled.
    let cancelled = false;

    openProjectDb(dbPath).then((db) => {
      if (cancelled) return;
      if (audioContext.state === 'closed') {
        // Should be unreachable now that the race above is closed — if this
        // ever fires again, the bug has a THIRD cause we haven't found yet.
        console.error('[AudioSoundboardWindow] audioContext was closed at mode-ready time — this should not happen; report if seen.');
      }
      setMode(audioContext.state === 'suspended' ? { kind: 'gate', db, audioContext } : { kind: 'ready', db, audioContext });
    }).catch(console.error);

    return () => {
      cancelled = true;
      void audioContext.close();
      audioContextRef.current = null;
    };
  }, [dbPath]);

  if (mode.kind === 'loading') {
    return <div className="audio-soundboard-window">{t('audioSoundboardLoading', 'Lade…')}</div>;
  }

  if (mode.kind === 'no-project') {
    return <div className="audio-soundboard-window">{t('audioSoundboardNoProject', 'Kein Projekt verbunden.')}</div>;
  }

  if (mode.kind === 'gate') {
    const { db, audioContext } = mode;
    return (
      <div className="audio-soundboard-window audio-soundboard-window__gate" role="dialog" aria-label={t('audioSoundboardGateTitle', 'Audiowiedergabe freigeben')}>
        <p>{t('audioSoundboardGateHint', 'Der Browser blockiert Audiowiedergabe ohne Nutzeraktion. Bitte freigeben.')}</p>
        <button
          className="btn btn--primary"
          onClick={() => {
            void audioContext.resume().then(() => setMode({ kind: 'ready', db, audioContext }));
          }}
        >
          {t('audioSoundboardGateButton', 'Soundboard aktivieren')}
        </button>
      </div>
    );
  }

  return (
    <DatabaseProvider value={mode.db}>
      <ReadyBoard db={mode.db} audioContext={mode.audioContext} projectDir={projectDir} />
    </DatabaseProvider>
  );
}

interface ReadyBoardProps {
  db: DatabaseLike;
  audioContext: AudioContext;
  projectDir: string | null;
}

function ReadyBoard({ db, audioContext, projectDir }: ReadyBoardProps) {
  const { t } = useTranslation('nav');
  const localEngineRef = useRef<LocalAudioEngine | null>(null);
  const youtubeEngineRef = useRef<YoutubeTierEngine | null>(null);
  const spotifyEngineRef = useRef<SpotifyTierEngine | null>(null);
  if (!localEngineRef.current) localEngineRef.current = new LocalAudioEngine(audioContext);
  if (!youtubeEngineRef.current) youtubeEngineRef.current = new YoutubeTierEngine();
  if (!spotifyEngineRef.current) spotifyEngineRef.current = new SpotifyTierEngine();
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [editingClip, setEditingClip] = useState<{ channelId: string; presetId: string | null } | null>(null);
  const [boardRefreshToken, setBoardRefreshToken] = useState(0);

  useEffect(() => {
    listScenes(db).then((scenes) => {
      setActiveSceneId((current) => current ?? scenes[0]?.id ?? null);
    }).catch(console.error);
  }, [db]);

  async function handleSelectScene(sceneId: string) {
    if (activeSceneId && activeSceneId !== sceneId) {
      const previous = await listScene(db, activeSceneId);
      if (previous) stopSceneAudio(previous, localEngineRef.current!, youtubeEngineRef.current!, spotifyEngineRef.current!);
    }
    setActiveSceneId(sceneId);
  }

  return (
    <EmojiPickerHostProvider>
      <div className="audio-soundboard-window">
        <h1>{t('audioSoundboardWindowTitle', 'Audio-Soundboard')}</h1>
        <SceneSwitcher database={db} activeSceneId={activeSceneId} onSelectScene={(id) => void handleSelectScene(id)} />
        {activeSceneId && (
          <SoundboardBoard
            database={db}
            sceneId={activeSceneId}
            localEngine={localEngineRef.current}
            youtubeEngine={youtubeEngineRef.current}
            spotifyEngine={spotifyEngineRef.current}
            refreshToken={boardRefreshToken}
            onEditClip={(channelId, presetId) => setEditingClip({ channelId, presetId })}
          />
        )}
        {editingClip && projectDir && (
          <ClipEditor
            database={db}
            projectDir={projectDir}
            channelId={editingClip.channelId}
            presetId={editingClip.presetId}
            onClose={() => setEditingClip(null)}
            onSaved={() => setBoardRefreshToken((n) => n + 1)}
          />
        )}
      </div>
    </EmojiPickerHostProvider>
  );
}
