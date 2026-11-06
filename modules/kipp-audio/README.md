# kipp-audio (local Expo module, Android only)

Native audio-device discovery, microphone routing and a **foreground-only** capture test for KIPP.
UI: You › Devices › **Audio device test** (`app/audio-test.tsx`, hook `src/hooks/useAudioDeviceTest.ts`).

## Pipeline

```
AudioManager.getDevices + AudioDeviceCallback ──► onDevicesChanged (JS)
startTest(id) ─► audio focus ─► route ─► AudioRecord (16-bit mono, 16 kHz → 48k/44.1k/8k fallback)
                                  │        └─ setPreferredDevice + OnRoutingChangedListener
                                  └─ BT, API 31+: MODE_IN_COMMUNICATION + setCommunicationDevice
                                     BT SCO, API 24–30: startBluetoothSco (waits for SCO_AUDIO_STATE_CONNECTED)
                                     LE Audio < API 31: rejected (UNSUPPORTED_ANDROID)
capture thread ─► WAV in cacheDir/kipp-audio-test ─► ~4 Hz onRecordingStatus (no PCM to JS)
stop ─► release AudioRecord ─► clearCommunicationDevice / stopBluetoothSco ─► restore mode ─► abandon focus
```

A route is "confirmed" only when `AudioRecord.getRoutedDevice()` matches the requested input.
Mismatch or a mid-recording route change stops the test (`ROUTE_MISMATCH` / `ROUTE_CHANGED`); the UI then
offers the phone microphone as an explicit choice. It never falls back silently.

## Privacy & cleanup

- Recording starts only from **Start test**; the screen shows a live recording indicator.
- Files live in app-private `cacheDir/kipp-audio-test/`; nothing is uploaded or logged (only a one-line summary
  with byte count / sample rate goes to logcat).
- Deleted by: the Delete button, starting a new test, leaving the screen, and on module creation at every app
  launch (removes files left by a test that was killed mid-recording). Android may also evict cache.
- Leaving the foreground stops recording (`APP_BACKGROUNDED`). No foreground service exists.

## Next: offline STT

Today STT can consume `RecordingResult.filePath` (PCM WAV, `sampleRate` in the result). For streaming, add a
native sink interface in `CaptureSession.captureLoop` (where bytes are written) that feeds sherpa-onnx/Whisper
in-process — routing, focus, lifecycle and diagnostics stay unchanged, and PCM still never crosses the bridge.

## Hardware test log

| Date | Phone / Android | Headset | Scenario | Result |
|---|---|---|---|---|
| _not yet run_ | | | | |
