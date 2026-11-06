import { create } from 'zustand';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { KippVoice as KippAudio, type ModelProgressEvent, type VoiceState, type VoiceStatus } from '../../modules/kipp-audio';
import { useAppStore } from '../stores/appStore';
import { runTurn } from './conversation';
import { speakable } from './speakable';
import { notifications } from './notifications';

// Hands-free KIPP: native code listens for "Hey KIPP", detects when you finish speaking and transcribes
// on-device; this controller runs the AI turn and hands the reply back to be spoken.

type HandsFree = {
  available: boolean;
  listening: boolean;
  state: VoiceState;
  inConversation: boolean;
  models: VoiceStatus['models'] | null;
  download: { active: boolean; fraction: number; error: string | null };
  lastHeard: string | null;
  error: string | null;
};

export const useHandsFree = create<HandsFree>(() => ({
  available: !!KippAudio,
  listening: false,
  state: 'stopped',
  inConversation: false,
  models: null,
  download: { active: false, fraction: 0, error: null },
  lastHeard: null,
  error: null,
}));

const set = useHandsFree.setState;

/** Phrases that close the conversation (back to waiting for "Hey KIPP"). */
const EXIT = /^(?:ok(?:ay)?[,\s]*)?(?:stop|that'?s all|that is all|never ?mind|goodbye|bye(?: kipp?)?|thanks?,? that'?s (?:it|all)|thank you,? that'?s (?:it|all)|go to sleep)[.!]?$/i;

const phaseFor = (s: VoiceState): ReturnType<typeof useAppStore.getState>['phase'] =>
  s === 'listening' || s === 'hearing' ? 'listening'
    : s === 'transcribing' || s === 'thinking' ? 'thinking'
    : s === 'speaking' ? 'speaking'
    : 'idle';

let initialized = false;
const queue: string[] = [];
let turnRunning = false;

async function handleUtterance(text: string) {
  const native = KippAudio;
  if (!native) return;
  set({ lastHeard: text });
  if (EXIT.test(text.trim())) {
    await native.endConversation();
    native.speak('Okay.').catch(() => {});
    return;
  }
  if (turnRunning) { queue.push(text); return; }
  turnRunning = true;
  try {
    let next: string | undefined = text;
    while (next) {
      const result = await runTurn(next);
      next = queue.shift();
      if (next) continue; // they kept talking; answer the latest thing instead of stale replies
      if (result.ok && speakable(result.turn.reply)) {
        await native.speak(speakable(result.turn.reply));
        if (result.turn.proposedActions.length) useAppStore.getState().setPhase('action');
      } else {
        if (!result.ok) {
          set({ error: result.error });
          await native.speak("Sorry, I couldn't reach my brain just now.").catch(() => native.replyFinished());
        } else {
          await native.replyFinished();
        }
      }
    }
  } finally {
    turnRunning = false;
  }
}

/** Subscribe to native voice events once, at app start. Safe to call repeatedly. */
export function initHandsFree() {
  const native = KippAudio;
  if (initialized || !native) return;
  initialized = true;
  native.addListener('onVoiceState', (e) => {
    set({ state: e.state, inConversation: e.inConversation, listening: e.state !== 'stopped' });
    const { phase, setPhase } = useAppStore.getState();
    // Don't clobber "action" (approval cards) with idle.
    const next = phaseFor(e.state);
    if (!(phase === 'action' && next === 'idle')) setPhase(next);
  });
  native.addListener('onUtterance', (e) => { handleUtterance(e.text); });
  native.addListener('onSpeech', (e) => {
    // Speech outside hands-free (typed chat replies) drives the orb directly.
    if (useHandsFree.getState().listening) return;
    const { setPhase } = useAppStore.getState();
    if (e.status === 'start') setPhase('speaking');
    else setPhase('idle');
  });
  native.addListener('onVoiceError', (e) => set({ error: e.message, ...(e.fatal ? { listening: false, state: 'stopped' as const } : {}) }));
  native.addListener('onModelProgress', onModelProgress);
  refreshVoiceStatus();
}

function onModelProgress(e: ModelProgressEvent) {
  if (e.error) return set({ download: { active: false, fraction: 0, error: e.error } });
  if (e.done) {
    set({ download: { active: false, fraction: 1, error: null } });
    refreshVoiceStatus();
    return;
  }
  set({ download: { active: true, fraction: e.total > 0 ? e.downloaded / e.total : 0, error: null } });
}

export async function refreshVoiceStatus() {
  if (!KippAudio) return;
  try {
    const s = await KippAudio.getVoiceStatus();
    set({ models: s.models, listening: s.listening, state: s.state, inConversation: s.inConversation, download: { ...useHandsFree.getState().download, active: s.downloading } });
  } catch {
    // Older build without voice support.
  }
}

export async function downloadVoiceModels() {
  if (!KippAudio) return;
  set({ download: { active: true, fraction: 0, error: null } });
  await KippAudio.downloadVoiceModels();
}

export const cancelVoiceDownload = () => KippAudio?.cancelVoiceDownload();

/** Turn on hands-free listening. Must be called from a user tap while the app is visible. */
export async function startHandsFree(inputDeviceId: string | null = null): Promise<boolean> {
  if (!KippAudio) return false;
  set({ error: null });
  const mic = await requestRecordingPermissionsAsync();
  if (!mic.granted) {
    set({ error: mic.canAskAgain ? 'KIPP needs the microphone to listen.' : 'Microphone access is off for KIPP. Enable it in Settings › Apps › KIPP › Permissions.' });
    return false;
  }
  // Android 13+: lets the "KIPP is listening" notification show. Listening works either way.
  await notifications()?.requestPermissionsAsync().catch(() => null);
  try {
    await KippAudio.startListening(inputDeviceId, null);
    set({ listening: true, state: 'starting' });
    return true;
  } catch (e) {
    set({ error: (e as Error)?.message ?? 'Could not start listening.' });
    return false;
  }
}

export async function stopHandsFree() {
  if (!KippAudio) return;
  await KippAudio.stopListening().catch(() => {});
  set({ listening: false, state: 'stopped', inConversation: false });
}

export function voiceStateLabel(s: VoiceState, inConversation: boolean): string {
  switch (s) {
    case 'starting': return 'Waking up…';
    case 'waiting_for_wake': return 'Say "Hey KIPP"';
    case 'listening': return inConversation ? "I'm listening" : 'Say "Hey KIPP"';
    case 'hearing': return 'Hearing you…';
    case 'transcribing': return 'Got it…';
    case 'thinking': return 'Thinking…';
    case 'speaking': return 'Speaking';
    default: return 'Hands-free is off';
  }
}
