import { useCallback, useEffect, useRef, useState } from 'react';
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import {
  KippAudio,
  type AudioRoutingState,
  type RecordingResult,
  type RecordingStatus,
  type RouteEvent,
  type StartInfo,
} from '../../modules/kipp-audio';

export const TEST_DURATION_MS = 15_000;
export const TARGET_SAMPLE_RATE = 16_000;

export type TestPhase = 'idle' | 'starting' | 'recording' | 'stopping';
export type MicPermission = 'unknown' | 'granted' | 'denied' | 'blocked';
export type TestError = { code: string; message: string; deviceId: string | null };

function toError(e: unknown, deviceId: string | null): TestError {
  const err = e as { code?: string; message?: string };
  return { code: err?.code ?? 'UNKNOWN', message: err?.message ?? 'Something went wrong.', deviceId };
}

const fallbackCodes = new Set(['ROUTE_UNAVAILABLE', 'ROUTE_REJECTED', 'ROUTE_NOT_CONFIRMED', 'SCO_UNSUPPORTED', 'UNSUPPORTED_ANDROID', 'ROUTE_MISMATCH', 'ROUTE_CHANGED', 'DEVICE_DISCONNECTED']);
/** Whether to offer "use the phone microphone instead" — only ever as an explicit user choice. */
export const offersFallback = (code: string | undefined) => !!code && fallbackCodes.has(code);

/**
 * Drives the native KIPP audio-device test. JS only sees device lists, state transitions and ~4 Hz
 * status; audio stays native and lands in an app-private WAV.
 */
export function useAudioDeviceTest() {
  const [routing, setRouting] = useState<AudioRoutingState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhaseState] = useState<TestPhase>('idle');
  const [status, setStatus] = useState<RecordingStatus | null>(null);
  const [startInfo, setStartInfo] = useState<StartInfo | null>(null);
  const [result, setResult] = useState<RecordingResult | null>(null);
  const [events, setEvents] = useState<RouteEvent[]>([]);
  const [error, setError] = useState<TestError | null>(null);
  const [permission, setPermission] = useState<MicPermission>('unknown');
  const resultRef = useRef<RecordingResult | null>(null);
  const phaseRef = useRef<TestPhase>('idle');
  // Native callbacks and unmount cleanup need the latest phase synchronously, so keep a ref beside state.
  const setPhase = useCallback((p: TestPhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);
  useEffect(() => { resultRef.current = result; }, [result]);

  const refresh = useCallback(async () => {
    if (!KippAudio) return;
    try {
      setRouting(await KippAudio.getRoutingState());
    } catch (e) {
      setError(toError(e, null));
    }
  }, []);

  useEffect(() => {
    getRecordingPermissionsAsync()
      .then((p) => setPermission(p.granted ? 'granted' : p.canAskAgain ? 'unknown' : 'blocked'))
      .catch(() => {});
    if (!KippAudio) return;
    KippAudio.getRoutingState().then(setRouting).catch((e) => setError(toError(e, null)));
    const subs = [
      KippAudio.addListener('onDevicesChanged', setRouting),
      KippAudio.addListener('onRecordingStatus', setStatus),
      KippAudio.addListener('onRouteEvent', (e) => setEvents((prev) => [...prev.slice(-30), e])),
      KippAudio.addListener('onRecordingFinished', (r) => {
        setResult(r);
        setPhase('idle');
        if (r.status !== 'completed' && r.error) setError({ code: r.stopCode, message: r.error, deviceId: r.requestedInput.id });
        refresh();
      }),
    ];
    return () => {
      subs.forEach((s) => s.remove());
      // Leaving the screen ends the test and discards the throwaway recording.
      const native = KippAudio;
      if (!native) return;
      const pending = phaseRef.current !== 'idle' ? native.stopTest() : Promise.resolve(resultRef.current);
      pending
        .then((r) => (r?.filePath ? native.deleteRecording(r.filePath) : false))
        .catch(() => {});
    };
  }, [refresh, setPhase]);

  // Keep a valid selection: prefer a Bluetooth mic, else the phone mic. Drop selections that vanished.
  useEffect(() => {
    const inputs = routing?.availableInputs ?? [];
    if (selectedId && inputs.some((d) => d.id === selectedId)) return;
    if (phaseRef.current !== 'idle') return;
    const pick = inputs.find((d) => d.type === 'bluetooth') ?? inputs.find((d) => d.type === 'built_in') ?? inputs[0];
    setSelectedId(pick?.id ?? null);
  }, [routing, selectedId]);

  const ensurePermission = useCallback(async () => {
    const p = await requestRecordingPermissionsAsync();
    const next: MicPermission = p.granted ? 'granted' : p.canAskAgain ? 'denied' : 'blocked';
    setPermission(next);
    return p.granted;
  }, []);

  const discard = useCallback(async () => {
    const path = resultRef.current?.filePath;
    setResult(null);
    if (path && KippAudio) await KippAudio.deleteRecording(path).catch(() => false);
  }, []);

  const start = useCallback(async (deviceId: string | null = selectedId) => {
    if (!KippAudio || !deviceId || phaseRef.current !== 'idle') return;
    setError(null);
    if (!(await ensurePermission())) {
      setError({ code: 'PERMISSION_DENIED', message: 'KIPP needs microphone access to run the test.', deviceId });
      return;
    }
    await discard();
    setSelectedId(deviceId);
    setEvents([]);
    setStatus(null);
    setStartInfo(null);
    setPhase('starting');
    try {
      const info = await KippAudio.startTest(deviceId, TARGET_SAMPLE_RATE, TEST_DURATION_MS);
      setStartInfo(info);
      // A fast test may already have finished before the promise resolved.
      if ((phaseRef.current as TestPhase) === 'starting') setPhase('recording');
      refresh();
    } catch (e) {
      setPhase('idle');
      setError(toError(e, deviceId));
      refresh();
    }
  }, [discard, ensurePermission, refresh, selectedId, setPhase]);

  const stop = useCallback(async () => {
    if (!KippAudio || phaseRef.current === 'idle' || phaseRef.current === 'stopping') return;
    setPhase('stopping');
    try {
      const r = await KippAudio.stopTest();
      if (r) setResult(r);
    } catch (e) {
      setError(toError(e, selectedId));
    } finally {
      setPhase('idle');
    }
  }, [selectedId, setPhase]);

  return {
    available: !!KippAudio,
    routing, refresh,
    selectedId, setSelectedId,
    phase, status, startInfo, result, events, error, permission,
    start, stop, discard, clearError: () => setError(null),
  };
}
