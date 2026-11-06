import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { KippVoice as KippAudio } from '../../modules/kipp-audio';
import { useAppStore } from '../stores/appStore';
import { useHandsFree } from './handsfree';
import { speakable } from './speakable';

export { speakable };

/** Whether KIPP's neural (Kokoro) voice is downloaded and usable. */
export const neuralVoiceReady = () => !!KippAudio && useHandsFree.getState().models?.packs.tts === true;

/**
 * Speak a reply. Uses KIPP's on-device neural voice when available, else the system voice.
 * Phase goes to 'speaking' and back to 'idle' (hands-free updates phase from native events instead).
 */
export function speakReply(text: string) {
  const clean = speakable(text);
  if (!clean || Platform.OS === 'web') return;
  const { setPhase } = useAppStore.getState();
  if (neuralVoiceReady()) {
    // Native onSpeech events drive the phase (see handsfree.ts).
    KippAudio!.speak(clean).catch(() => fallback(clean, setPhase));
    return;
  }
  fallback(clean, setPhase);
}

function fallback(text: string, setPhase: ReturnType<typeof useAppStore.getState>['setPhase']) {
  setPhase('speaking');
  Speech.speak(text, { onDone: () => setPhase('idle'), onStopped: () => setPhase('idle'), onError: () => setPhase('idle') });
}

export function stopSpeaking() {
  Speech.stop();
  KippAudio?.stopSpeaking().catch(() => {});
}
