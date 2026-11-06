import { NativeModule, Platform, requireOptionalNativeModule } from 'expo';

// Contracts for KIPP's native Android audio pipeline. Future offline STT consumes `RecordingResult.filePath`
// (16-bit mono PCM WAV) today, and will reuse the same routing layer when streaming capture is added.

export type AudioDeviceType = 'bluetooth' | 'wired' | 'usb' | 'built_in' | 'unknown';

export type AudioDevice = {
  /** AudioDeviceInfo.id — stable only while the device stays connected. */
  id: string;
  name: string;
  type: AudioDeviceType;
  /** Human-readable Android type, e.g. "Bluetooth HFP/SCO". */
  typeName: string;
  androidType: number;
  isInput: boolean;
  isOutput: boolean;
  /** Listed by AudioManager right now. */
  isAvailable: boolean;
  /** Offered by getAvailableCommunicationDevices() (API 31+). null when the API doesn't exist. */
  isCommunicationDevice: boolean | null;
  /** Empty means the device accepts any rate. */
  sampleRates: number[];
  channelCounts: number[];
};

export type AudioRoutingState = {
  availableInputs: AudioDevice[];
  availableOutputs: AudioDevice[];
  communicationDeviceId: string | null;
  requestedInputId: string | null;
  actualInputId: string | null;
  isRecording: boolean;
  androidSdkInt: number;
  discoveryMs: number;
};

export type StartInfo = {
  requestedInput: AudioDevice;
  sampleRate: number;
  channelCount: number;
  encoding: 'PCM_16BIT';
  audioSource: string;
  communicationRouteConfirmMs: number | null;
  recorderInitMs: number | null;
  maxDurationMs: number;
};

export type RecordingStatus = {
  elapsedMs: number;
  bytes: number;
  peakLevel: number;
  actualInputId: string | null;
  routeConfirmed: boolean;
  readErrors: number;
};

export type RouteEvent = { type: string; message: string; atMs: number };

export type StopCode =
  | 'USER_STOPPED' | 'MAX_DURATION' | 'INTERRUPTED' | 'APP_BACKGROUNDED' | 'APP_CLOSED'
  | 'DEVICE_DISCONNECTED' | 'ROUTE_MISMATCH' | 'ROUTE_CHANGED' | 'AUDIO_DEAD_OBJECT'
  | 'READ_FAILED' | 'CAPTURE_FAILED' | 'FILE_FAILED';

export type RecordingResult = {
  status: 'completed' | 'interrupted' | 'failed';
  stopCode: StopCode;
  error: string | null;
  /** file:// URI of a WAV in app-private cache, or null if nothing was captured. */
  filePath: string | null;
  durationMs: number;
  bytes: number;
  sampleRate: number;
  channelCount: number;
  encoding: 'PCM_16BIT';
  audioSource: string;
  requestedInput: AudioDevice;
  actualInput: AudioDevice | null;
  routeConfirmed: boolean;
  communicationRouteConfirmMs: number | null;
  captureConfirmMs: number | null;
  recorderInitMs: number | null;
  readErrors: number;
  zeroReads: number;
  peakLevel: number;
  events: RouteEvent[];
};

type Events = {
  onDevicesChanged(state: AudioRoutingState): void;
  onRecordingStatus(status: RecordingStatus): void;
  onRouteEvent(event: RouteEvent): void;
  onRecordingFinished(result: RecordingResult): void;
};

declare class KippAudioNative extends NativeModule<Events> {
  getAndroidSdkInt(): number;
  getRoutingState(): Promise<AudioRoutingState>;
  startTest(deviceId: string, sampleRate: number, maxDurationMs: number): Promise<StartInfo>;
  stopTest(): Promise<RecordingResult | null>;
  deleteRecording(path: string): Promise<boolean>;
  deleteAllRecordings(): Promise<number>;
}

/** The native module, or null on iOS/web/Expo Go or a build made before the module was added. */
export const KippAudio: KippAudioNative | null =
  Platform.OS === 'android' ? requireOptionalNativeModule<KippAudioNative>('KippAudio') : null;

/** Error codes thrown by startTest (CodedError.code). */
export const START_ERROR_CODES = [
  'PERMISSION_DENIED', 'ALREADY_RECORDING', 'DEVICE_NOT_FOUND', 'AUDIO_FOCUS_DENIED',
  'ROUTE_UNAVAILABLE', 'ROUTE_REJECTED', 'ROUTE_NOT_CONFIRMED', 'SCO_UNSUPPORTED', 'UNSUPPORTED_ANDROID',
  'RECORDER_INIT_FAILED', 'RECORDER_START_FAILED', 'START_FAILED',
] as const;
