// M15-S15 (#286): stops every channel's audio when switching away from a
// scene, respecting each channel's own cut/fade transition — no clip is
// ever left abruptly hanging mid-playback across a scene switch (D7).
import type { SceneWithChannels } from './audio-service';
import type { LocalAudioEngine } from './local-audio-engine';
import type { YoutubeTierEngine } from './youtube-tier-engine';

export function stopSceneAudio(scene: SceneWithChannels, localEngine: LocalAudioEngine, youtubeEngine: YoutubeTierEngine): void {
  for (const channel of scene.channels) {
    const mixer = { transitionType: channel.transition_type, transitionSeconds: channel.transition_seconds };
    localEngine.stopChannel(channel.id, mixer);
    youtubeEngine.stopChannel(channel.id, mixer);
  }
}
