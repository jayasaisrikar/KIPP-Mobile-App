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

## Hands-free voice (`voice/`)

```
VoiceService (foreground service, type=microphone, "KIPP is listening" notification + Stop)
  └─ VoiceEngine: AudioRecord 16 kHz ─► Silero VAD v5 ─┬─► wake-word spotter ("Hey/Hi/OK KIPP", GigaSpeech KWS)
                                                       └─► segment ─► Moonshine base (int8) ─► onUtterance (JS)
JS (src/lib/handsfree.ts) ─► runTurn() ─► KippAudio.speak(reply) ─► Speaker: Kokoro v1.0 int8 → AudioTrack
```

- **Addressing:** outside a conversation, speech is discarded unless the wake word was spotted in it.
  After "Hey KIPP" the conversation stays open until 20 s of quiet or "stop / that's all / never mind".
- **Turn-taking:** utterance ends after 0.8 s of silence; if the transcript ends mid-thought ("and", "um",
  trailing comma) it waits 1.5 s more. Speaking again extends the wait.
- **Echo:** on the phone speaker the mic is ignored while KIPP talks (+350 ms). With headphones, talking over
  KIPP for 300 ms interrupts it (barge-in).
- **Models** (~380 MB download, app-private `filesDir/kipp-voice/`): silero_vad_v5, kws-zipformer-gigaspeech-3.3M
  (mobile), moonshine-base-en-int8, kokoro-int8-multi-lang-v1_0 (voice `af_heart`, sid 3).
- **sherpa-onnx is pinned to v1.13.8:** 2.x removed espeak-ng, so Kokoro would silently drop words missing
  from its lexicon (names, "KIPP").
- Listening stops when the app is swiped away (`stopWithTask`); the AI turn runs in the app's JS.

## Next: offline STT

Today STT can consume `RecordingResult.filePath` (PCM WAV, `sampleRate` in the result). For streaming, add a
native sink interface in `CaptureSession.captureLoop` (where bytes are written) that feeds sherpa-onnx/Whisper
in-process — routing, focus, lifecycle and diagnostics stay unchanged, and PCM still never crosses the bridge.

## Hardware test log

| Date | Phone / Android | Headset | Scenario | Result |
|---|---|---|---|---|
| _not yet run_ | | | | |
