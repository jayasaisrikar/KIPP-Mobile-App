import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { requireOptionalNativeModule } from 'expo';

// Speech-to-text via expo-speech-recognition (needs a development build, not Expo Go).
type SpeechModule = typeof import('expo-speech-recognition');
let mod: SpeechModule | null | undefined;

function lib(): SpeechModule | null {
  if (mod !== undefined) return mod;
  mod = null;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return mod;
  // The package resolves its native module lazily and throws then, so check it's in this build first.
  if (Platform.OS !== 'web' && !requireOptionalNativeModule('ExpoSpeechRecognition')) return mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-speech-recognition') as SpeechModule;
  } catch {
    mod = null;
  }
  return mod;
}

/** Why voice input can't be used right now, or null if it can. */
export function voiceUnavailableReason(): string | null {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return 'Voice input needs a development build — it does not run in Expo Go.';
  const m = lib();
  if (!m) return 'Voice input is not in this build yet. Rebuild the app with npx expo run:ios or run:android.';
  try {
    if (!m.ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      return Platform.OS === 'web' ? 'This browser does not support speech recognition.' : 'Speech recognition is not available on this device.';
    }
  } catch {
    return 'Speech recognition is not available on this device.';
  }
  return null;
}

const errorText: Record<string, string> = {
  'not-allowed': 'Microphone or speech permission was denied. Enable it in system settings.',
  'service-not-allowed': 'Speech recognition is turned off on this device.',
  'language-not-supported': 'Your language is not supported for speech recognition.',
  network: 'Speech recognition needs a network connection.',
  'audio-capture': 'Could not access the microphone.',
};

/**
 * Live transcription. `start()` begins listening; `stop()` ends it and calls
 * `onFinal` with the transcript (empty if nothing was heard). `start()` resolves false if listening couldn't begin.
 */
export function useVoiceInput(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const finalRef = useRef('');
  const onFinalRef = useRef(onFinal);
  useEffect(() => { onFinalRef.current = onFinal; }, [onFinal]);

  useEffect(() => {
    const m = lib();
    if (!m) return;
    const sr = m.ExpoSpeechRecognitionModule;
    const subs = [
      sr.addListener('start', () => setListening(true)),
      sr.addListener('result', (e) => {
        const text = e.results[0]?.transcript ?? '';
        setTranscript(text);
        finalRef.current = text;
      }),
      sr.addListener('error', (e) => {
        if (e.error !== 'aborted' && e.error !== 'no-speech') setError(errorText[e.error] ?? e.message ?? 'Voice input failed.');
      }),
      sr.addListener('end', () => {
        setListening(false);
        const text = finalRef.current.trim();
        finalRef.current = '';
        setTranscript('');
        onFinalRef.current(text);
      }),
    ];
    return () => { subs.forEach((s) => s.remove()); sr.abort(); };
  }, []);

  const start = async () => {
    setError(null);
    const reason = voiceUnavailableReason();
    const m = lib();
    if (reason || !m) { setError(reason); return false; }
    const perm = await m.ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) { setError(errorText['not-allowed']); return false; }
    finalRef.current = '';
    setTranscript('');
    m.ExpoSpeechRecognitionModule.start({ lang: Intl.DateTimeFormat().resolvedOptions().locale || 'en-US', interimResults: true, continuous: Platform.OS !== 'android' });
    // Android's continuous mode splits results into segments, so it stops after a pause instead.
    return true;
  };

  // stop() lets the recognizer deliver its final result before 'end' fires.
  const stop = () => lib()?.ExpoSpeechRecognitionModule.stop();

  return { listening, transcript, error, start, stop, clearError: () => setError(null) };
}
